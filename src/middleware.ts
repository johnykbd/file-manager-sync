import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse, NextRequest } from "next/server"

const { auth } = NextAuth(authConfig);

// @ts-ignore
export default auth((req: NextRequest & { auth: any }) => {
    const isLoggedin = !!req.auth;
    const isLoginPage = req.nextUrl.pathname === "/login";

    if (!isLoggedin && !isLoginPage) {
        return NextResponse.redirect(new URL("/login", req.nextUrl));
    }

    if (isLoggedin && isLoginPage) {
        return NextResponse.redirect(new URL("/", req.nextUrl));
    }

    return NextResponse.next();
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*.js|icon-.*.png).*)"],
}
