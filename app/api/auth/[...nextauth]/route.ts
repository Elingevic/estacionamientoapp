import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Esta es la configuración base para el "Login Único" (SSO).
// Como RRHH necesita los perfiles unificados, aquí puedes añadir el Provider
// de tu empresa (Google, Entra ID / Azure AD, Okta, etc.).
// Por ahora he dejado un CredentialsProvider de prueba para que puedas 
// testear la aplicación mientras conectas tu proveedor real.

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Login Corporativo",
      credentials: {
        email: { label: "Correo", type: "email", placeholder: "empleado@empresa.com" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        // --- AQUÍ CONECTARÍAS CON TU API DE RRHH O ACTIVE DIRECTORY ---
        // Por ahora simulamos un login exitoso genérico:
        if (credentials?.email) {
          return {
            id: "empleado-123",
            name: "Usuario Demo",
            email: credentials.email,
            // Podemos pasar datos custom como la cédula o cargo
            image: "12345678|Analista" 
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Guardamos los datos extra en el token
        const extraData = user.image ? user.image.split("|") : ["", ""];
        token.cedula = extraData[0];
        token.cargo = extraData[1];
        // En NextAuth, para proteger las rutas administrativas, podemos chequear el correo:
        token.role = user.email?.includes("rrhh") ? "rrhh" : "empleado";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).cedula = token.cedula;
        (session.user as any).cargo = token.cargo;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    // signIn: "/login", // Puedes personalizar la página de login luego
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
