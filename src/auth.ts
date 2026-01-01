
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "./auth.config"
import { getUser, verifyPassword } from "@/lib/db"

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) {
                    return null;
                }

                const user = await getUser(credentials.username as string);
                if (!user) return null;

                const isValid = await verifyPassword(credentials.password as string, user.passwordHash);
                if (!isValid) return null;

                return {
                    id: user.username,
                    name: user.username,
                    // @ts-ignore
                    role: user.role,
                };
            },
        }),
    ],
    secret: process.env.AUTH_SECRET || "12345678901234567890123456789012",
})
