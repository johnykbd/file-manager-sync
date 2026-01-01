
import Credentials from "next-auth/providers/credentials"
import type { NextAuthConfig } from "next-auth"

export const authConfig = {
    providers: [
        Credentials({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize() {
                return null;
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                // @ts-ignore
                token.role = user.role;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                // @ts-ignore
                session.user.role = token.role;
            }
            return session;
        }
    },
    pages: {
        signIn: '/login',
    },
    secret: "12345678901234567890123456789012", // Must be same as in auth.ts
} satisfies NextAuthConfig;
