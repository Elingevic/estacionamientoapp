import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../[...nextauth]/route";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const keycloakIssuer =
      process.env.KEYCLOAK_ISSUER ||
      process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ||
      "http://172.16.205.33:8080/realms/sudeaseg";
    const clientId =
      process.env.KEYCLOAK_ID ||
      process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ||
      "sudeparking";

    const host = req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const baseUrl = `${proto}://${host}`;
    const postLogoutRedirectUri = `${baseUrl}/`;

    const idToken = (session as any)?.id_token;
    let logoutUrl = `${keycloakIssuer}/protocol/openid-connect/logout?client_id=${encodeURIComponent(
      clientId
    )}&post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`;
    
    if (idToken) {
      logoutUrl += `&id_token_hint=${encodeURIComponent(idToken)}`;
    }

    const response = NextResponse.redirect(logoutUrl);

    // Invalidador exhaustivo de cookies de sesión NextAuth (normales, seguras y chunks .0, .1, etc.)
    const cookiesToClear = [
      "next-auth.session-token",
      "next-auth.session-token.0",
      "next-auth.session-token.1",
      "next-auth.session-token.2",
      "__Secure-next-auth.session-token",
      "__Secure-next-auth.session-token.0",
      "__Secure-next-auth.session-token.1",
      "__Secure-next-auth.session-token.2",
      "next-auth.csrf-token",
      "__Host-next-auth.csrf-token",
      "next-auth.callback-url",
      "__Secure-next-auth.callback-url",
      "next-auth.pkce.code_verifier",
    ];

    for (const cookieName of cookiesToClear) {
      response.cookies.set(cookieName, "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
    }

    return response;
  } catch (error) {
    console.error("Error en federated-logout:", error);
    return NextResponse.redirect(new URL("/", req.url));
  }
}
