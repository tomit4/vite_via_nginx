import type {
    FastifyInstance,
    FastifyPluginOptions,
    FastifyReply,
    FastifyRequest,
    HookHandlerDoneFunction,
} from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import sendEmail from '../../utils/send-email'
import hasher from '../../utils/hasher'

type BodyReq = {
    email: string
}

type ForgotPassAskRes = {
    ok: boolean
    message?: string
}

export default (
    fastify: FastifyInstance,
    options: FastifyPluginOptions,
    done: HookHandlerDoneFunction,
) => {
    fastify.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/forgot-password-ask',
        config: {
            rateLimit: {
                max: 5,
                timeWindow: 300000, // 5 minutes
            },
        },
        schema: {
            body: z.object({
                email: z.string(),
            }),
            response: {
                200: z.object({
                    ok: z.boolean(),
                    message: z.string(),
                }),
            },
        },
        handler: async (
            request: FastifyRequest<{ Body: BodyReq }>,
            reply: FastifyReply,
        ): Promise<ForgotPassAskRes> => {
            const { email } = request.body
            const { userService } = fastify
            const hashedEmail = hasher(email)
            const emailSchema = z.string().email()
            const zParsedEmail = emailSchema.safeParse(email)
            try {
                const userAlreadyInDb =
                    await userService.grabUserByEmail(hashedEmail)
                const userAlreadyInCache = await userService.isInCache(
                    hashedEmail,
                    'forgot-pass-ask',
                )
                if (!zParsedEmail.success) {
                    const { error } = zParsedEmail
                    throw new Error(error.issues[0].message as string)
                }
                if (!userAlreadyInDb || userAlreadyInDb.is_deleted)
                    throw new Error(
                        'There is no record of that email address, please sign up.',
                    )
                if (userAlreadyInCache)
                    throw new Error(
                        'You have already submitted your email, please check your inbox.',
                    )
                const emailSent = await sendEmail(
                    email as string,
                    `verify-forgot-pass/${hashedEmail}` as string,
                    process.env
                        .BREVO_FORGOT_PASSWORD_TEMPLATE_ID as unknown as number,
                )
                if (!emailSent.wasSuccessfull) {
                    fastify.log.error(
                        'Error occurred while sending email, are your Brevo credentials up to date? :=>',
                        emailSent.error,
                    )
                    throw new Error(
                        'An error occurred while sending email, please contact support.',
                    )
                }
                const sessionToken = userService.signToken(
                    hashedEmail,
                    process.env.JWT_SESSION_EXP as string,
                )
                await userService.setInCacheWithExpiry(
                    hashedEmail,
                    'forgot-pass-ask',
                    email,
                    60,
                )
                reply
                    .code(200)
                    .setCookie('appname-forgot-pass-ask-token', sessionToken, {
                        secure: true,
                        httpOnly: true,
                        sameSite: true,
                    })
                    .send({
                        ok: true,
                        message: `Your forgot password request was successfully sent to ${email}!`,
                    })
            } catch (err) {
                if (err instanceof Error) {
                    reply.send({
                        ok: false,
                        message: err.message,
                    })
                }
            }
            return reply
        },
    })
    done()
}
