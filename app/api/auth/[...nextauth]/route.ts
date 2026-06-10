import NextAuth, { NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_ID || "sudeparking",
      clientSecret: process.env.KEYCLOAK_SECRET || "gDq5z6je1ma70PfRHU8ANVRwvNX6n9Nx",
      issuer: process.env.KEYCLOAK_ISSUER || "http://172.16.205.33:8080/realms/sudeaseg"
    })
  ],
  callbacks: {
    async jwt({ token, user, profile }) {
      // Cuando el usuario inicia sesión, guardamos sus datos en el token
      if (user) {
        // Validamos si tiene permisos de rrhh basado en su correo o algún rol
        // Por ahora, si su correo contiene "rrhh", le damos acceso al dashboard.
        token.role = user.email?.includes("rrhh") ? "rrhh" : "empleado";
      }
      return token;
    },
    async session({ session, token }) {
      // Pasamos los datos del token a la sesión en el cliente
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  // Es obligatorio configurar un NEXTAUTH_SECRET en producción. 
  // Usa una variable de entorno en Vercel, o dejamos un fallback para desarrollo:
  secret: process.env.NEXTAUTH_SECRET || "super-secret-key-para-desarrollo-12345",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
