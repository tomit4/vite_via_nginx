"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const password_1 = require("../../schemas/password");
exports.default = (fastify, options, done) => {
    fastify.withTypeProvider().route({
        method: 'PATCH',
        url: '/forgot-password-change',
        config: {
            rateLimit: {
                max: 5,
                timeWindow: 300000, // 5 minutes
            },
        },
        schema: {
            body: zod_1.z.object({
                newPassword: zod_1.z.string(),
                hash: zod_1.z.string(),
            }),
            response: {
                200: zod_1.z.object({
                    ok: zod_1.z.boolean(),
                    message: zod_1.z.string(),
                }),
                400: zod_1.z.object({
                    ok: zod_1.z.boolean(),
                    message: zod_1.z.string(),
                }),
                401: zod_1.z.object({
                    ok: zod_1.z.boolean(),
                    message: zod_1.z.string(),
                }),
            },
        },
        handler: async (request, reply) => {
            const { userService } = fastify;
            const { newPassword, hash } = request.body;
            const sessionToken = request.cookies['appname-forgot-pass-ask-token'];
            const passwordSchema = zod_1.z.string().regex(password_1.passwordSchemaRegex, {
                message: password_1.passwordSchemaErrMsg,
            });
            const zParsedPassword = passwordSchema.safeParse(newPassword);
            try {
                if (!zParsedPassword.success) {
                    const { error } = zParsedPassword;
                    throw new Error(error.issues[0].message);
                }
                const sessionTokenIsValid = userService.verifyToken(sessionToken);
                const { email } = sessionTokenIsValid;
                if (hash !== email) {
                    reply.code(400);
                    throw new Error('Provided Hashes do not match, please try again');
                }
                const emailFromCache = await userService.grabFromCache(email, 'forgot-pass-ask');
                if (!emailFromCache) {
                    reply.code(401);
                    throw new Error('You took too long to answer the forgot password email, please try again');
                }
                const userPasswordByEmail = await userService.grabUserByEmailAndIsNotDeleted(email);
                const { password } = userPasswordByEmail;
                const passwordHashesMatch = await userService.comparePasswordToHash(newPassword, password);
                // TODO: set up separate db table that keeps track of last 5 passwords
                // for user and throws this 409 reply if new password is in table
                // (i.e. newPassword cannot be the same as last 5 passwords)
                if (passwordHashesMatch) {
                    fastify.log.warn('User claimed they forgot their password, but uses their original password...');
                    reply.code(409).send({
                        ok: false,
                        message: 'Password provided is not original, please try again with a different password.',
                    });
                }
                const newHashedPassword = await userService.hashPassword(newPassword);
                await userService.updatePassword(email, newHashedPassword);
                await userService.removeFromCache(email, 'forgot-pass-ask');
                reply
                    .code(200)
                    .clearCookie('appname-forgot-pass-ask', {
                    path: '/onboarding',
                })
                    .send({
                    ok: true,
                    message: 'You have successfully changed your password!',
                });
            }
            catch (err) {
                if (err instanceof Error)
                    reply.send({
                        ok: false,
                        message: err.message,
                    });
            }
            return reply;
        },
    });
    done();
};
