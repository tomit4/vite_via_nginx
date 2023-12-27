import type {
    FastifyInstance,
    FastifyPluginOptions,
    FastifyReply,
    FastifyRequest,
    HookHandlerDoneFunction,
} from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { VerifyPayloadType } from '@fastify/jwt'
import { z } from 'zod'

type BodyReq = {
    inputPassword: string
}

/*
type AuthRes = {
    ok: boolean
    message?: string
    error?: string
    sessionToken?: string
}
*/
export default (
    fastify: FastifyInstance,
    options: FastifyPluginOptions,
    done: HookHandlerDoneFunction,
) => {
    fastify.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/change-password',
        config: {
            rateLimit: {
                max: 5,
                timeWindow: 300000, // 5 minutes
            },
        },
        /*
        schema: {
            body: z.object({
                email: z.string(),
                loginPassword: z.string(),
            }),
            response: {
                200: z.object({
                    ok: z.boolean(),
                    message: z.string(),
                    sessionToken: z.string(),
                }),
                401: z.object({
                    ok: z.boolean(),
                    message: z.string(),
                }),
                500: z.object({
                    ok: z.boolean(),
                    message: z.string(),
                }),
            },
        },
        */
        handler: async (
            request: FastifyRequest<{ Body: BodyReq }>,
            reply: FastifyReply,
            // ): Promise<AuthRes> => {
        ) => {
            const { redis, knex, bcrypt, jwt } = fastify
            const { inputPassword } = request.body
            const refreshToken = request.cookies[
                'appname-refresh-token'
            ] as string
            let hashedEmail: string
            let rawEmailFromRedis: string | null
            let userByEmail
            const refreshTokenIsValid = jwt.verify(
                refreshToken,
            ) as VerifyPayloadType

            if (
                typeof refreshTokenIsValid === 'object' &&
                'email' in refreshTokenIsValid
            ) {
                hashedEmail = refreshTokenIsValid.email as string
                if (!hashedEmail) {
                    return reply.code(401).send({
                        ok: false,
                        error: 'No refresh token provided by client, redirecting to home.',
                    })
                }
                rawEmailFromRedis = await redis.get(`${hashedEmail}-email`)
                if (!rawEmailFromRedis) {
                    return reply.code(401).send({
                        ok: false,
                        error: 'No refresh token in cache, redirecting to home.',
                    })
                }
                userByEmail = await knex('users')
                    .select('password')
                    .where('email', hashedEmail)
                    .first()
            }

            const passwordSchemaRegex = new RegExp(
                [
                    /^(?=.*[a-z])/, // At least one lowercase letter
                    /(?=.*[A-Z])/, // At least one uppercase letter
                    /(?=.*\d)/, // At least one digit
                    /(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/, // At least one special character
                    /[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{10,}$/, // At least 10 characters long
                ]
                    .map(r => r.source)
                    .join(''),
            )
            const passwordSchemaErrMsg =
                'Password must be at least 10 characters in length and contain at \
                least one lowercase letter, one uppercase letter, one digit, and one \
                special character'
            const passwordSchema = z.string().regex(passwordSchemaRegex, {
                message: passwordSchemaErrMsg,
            })
            const zParsedPassword = passwordSchema.safeParse(inputPassword)
            if (!zParsedPassword.success) {
                const { error } = zParsedPassword
                throw new Error(error.issues[0].message as string)
            }
            const { password } = userByEmail
            const passwordHashesMatch = await bcrypt
                .compare(inputPassword, password)
                .then(match => match)
                .catch(err => err)
            if (!passwordHashesMatch) {
                return reply.code(401).send({
                    ok: false,
                    message: 'Incorrect email or password. Please try again.',
                })
            }
            return reply.code(200).send({
                ok: true,
                message:
                    'Your password is authenticated, please answer your email to continue change of password',
            })
        },
    })
    done()
}