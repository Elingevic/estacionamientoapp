import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Login Corporativo",
      credentials: {
        email: { label: "Correo Corporativo", type: "email", placeholder: "empleado@sudeaseg.gob.ve" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        // MODO DEMO: Acepta cualquier correo y contraseña para facilitar la demostración
        if (credentials?.email) {
          return {
            id: "demo-id-" + Math.random(),
            name: "Usuario de Prueba",
            email: credentials.email,
          };
        }
        return null;
      },
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // MODO DEMO: Si el correo de prueba incluye 'rrhh' le damos permisos administrativos
        token.role = user.email?.includes("rrhh") ? "rrhh" : "empleado";
      }
      return token;
    },
    async session({ session, token }) {
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
  secret: process.env.NEXTAUTH_SECRET || "super-secret-key-para-desarrollo-12345",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
