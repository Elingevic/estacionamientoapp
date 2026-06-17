import NextAuth, { NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_ID!,
      clientSecret: process.env.KEYCLOAK_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
      profile(profile) {
        console.log("=== KEYCLOAK PROFILE RECIBIDO ===", profile);
        
        // Extraer de userdata si Keycloak lo envía
        let ud: any = {};
        if (profile.userdata) {
           try {
             ud = typeof profile.userdata === "string" ? JSON.parse(profile.userdata) : profile.userdata;
           } catch (e) {
             console.error("Error parseando userdata:", e);
           }
        }

        return {
          id: profile.sub,
          name: profile.name ?? profile.fullname ?? `${profile.given_name ?? ''} ${profile.family_name ?? ''}`.trim() ?? profile.preferred_username,
          email: profile.email,
          cedula: ud.cedula || ud.documentid || profile.documentid || profile.cedula,
          cargo: ud.cargo || profile.cargo,
          given_name: profile.given_name,
          family_name: profile.family_name,
          fullname: ud.fullname || profile.fullname,
          documentid: ud.documentid || profile.documentid,
          office_id: ud.office_id || profile.office_id,
          position_id: ud.position_id || profile.position_id,
          company_rif: ud.company_rif || profile.company_rif,
          assigned_systems: ud.assigned_systems || profile.assigned_systems
        };
      }
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("=== SIGN-IN RAW ACCOUNT ===", account);
      console.log("=== SIGN-IN RAW PROFILE ===", profile);
      // Verificamos si el mapper devolvió datos (ej. documentid, position_id o sistemas asignados)
      const hasSystemAccess = (user as any).assigned_systems?.includes("sudeparking");
      const hasUserData = (user as any).documentid || (user as any).position_id || (user as any).cargo;

      if (!hasUserData || !hasSystemAccess) {
        console.warn("Acceso denegado: el usuario no tiene los claims necesarios o no está asignado a sudeparking.");
        return "/acceso-denegado"; // NextAuth redirigirá automáticamente a esta URL
      }
      return true;
    },
    async jwt({ token, user, profile, account }) {
      // Extraemos la información del id_token de Keycloak si está disponible (solo ocurre al momento de iniciar sesión)
      let keycloakClaims: any = {};
      if (account?.id_token) {
        try {
          // Decodificar la parte del payload (segunda parte) del JWT
          const base64Payload = account.id_token.split('.')[1];
          const payload = Buffer.from(base64Payload, 'base64').toString('utf-8');
          keycloakClaims = JSON.parse(payload);
          console.log("=== DECODED KEYCLOAK ID TOKEN ===", keycloakClaims);
        } catch (e) {
          console.error("Error decodificando id_token:", e);
        }
      }

      if (user || Object.keys(keycloakClaims).length > 0) {
        // Tomar de userdata si existe, sino tomar de la raíz de los claims, sino de lo que extrajimos en profile
        const ud = keycloakClaims.userdata ? (typeof keycloakClaims.userdata === 'string' ? JSON.parse(keycloakClaims.userdata) : keycloakClaims.userdata) : keycloakClaims;
        
        token.role = user?.email?.toLowerCase().includes("rrhh") ? "rrhh" : "empleado";
        token.cedula = ud.documentid || ud.cedula || (user as any)?.cedula || (profile as any)?.cedula;
        token.cargo = ud.cargo || ud.position_id || (user as any)?.cargo || (profile as any)?.cargo;
        token.given_name = ud.given_name || (user as any)?.given_name || (profile as any)?.given_name;
        token.family_name = ud.family_name || (user as any)?.family_name || (profile as any)?.family_name;
        token.fullname = ud.fullname || (user as any)?.fullname || (profile as any)?.fullname;
        token.documentid = ud.documentid || (user as any)?.documentid || (profile as any)?.documentid;
        token.office_id = ud.office_id || (user as any)?.office_id || (profile as any)?.office_id;
        token.position_id = ud.position_id || (user as any)?.position_id || (profile as any)?.position_id;
        token.company_rif = ud.company_rif || (user as any)?.company_rif || (profile as any)?.company_rif;
        token.assigned_systems = ud.assigned_systems || (user as any)?.assigned_systems || (profile as any)?.assigned_systems;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).cedula = token.cedula;
        (session.user as any).cargo = token.cargo;
        (session.user as any).given_name = token.given_name;
        (session.user as any).family_name = token.family_name;
        (session.user as any).fullname = token.fullname;
        (session.user as any).documentid = token.documentid;
        (session.user as any).office_id = token.office_id;
        (session.user as any).position_id = token.position_id;
        (session.user as any).company_rif = token.company_rif;
        (session.user as any).assigned_systems = token.assigned_systems;
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
