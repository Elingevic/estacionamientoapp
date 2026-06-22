import NextAuth, { NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_ID!,
      clientSecret: process.env.KEYCLOAK_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
      profile(profile, tokens) {
        console.log("=== KEYCLOAK PROFILE RECIBIDO ===", profile);
        
        let customClaims: any = {};
        if (tokens?.access_token) {
          try {
            const base64Payload = tokens.access_token.split('.')[1];
            const payload = Buffer.from(base64Payload, 'base64').toString('utf-8');
            customClaims = JSON.parse(payload);
            console.log("=== DECODED KEYCLOAK ACCESS TOKEN IN PROFILE ===", customClaims);
          } catch (e) {
            console.error("Error decodificando access_token en profile:", e);
          }
        }

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
          name: profile.name ?? profile.fullname ?? customClaims.fullname ?? `${profile.given_name ?? ''} ${profile.family_name ?? ''}`.trim() ?? profile.preferred_username,
          email: profile.email,
          cedula: customClaims.documentid || ud.cedula || ud.documentid || profile.documentid || profile.cedula,
          cargo: customClaims.position_id || customClaims.cargo || ud.position_id || ud.cargo || profile.cargo || profile.position_id,
          given_name: profile.given_name,
          family_name: profile.family_name,
          fullname: customClaims.fullname || ud.fullname || profile.fullname,
          documentid: customClaims.documentid || ud.documentid || profile.documentid,
          office_id: customClaims.office_id || ud.office_id || profile.office_id,
          position_id: customClaims.position_id || ud.position_id || profile.position_id,
          company_rif: customClaims.company_rif || ud.company_rif || profile.company_rif,
          assigned_systems: customClaims.assigned_systems || ud.assigned_systems || profile.assigned_systems
        };
      }
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.includes("172.16.205.33:8080")) {
        return url;
      }
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch (e) {
        console.error("Error parseando url en redirect callback:", e);
      }
      return baseUrl;
    },
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
      // Extraemos la información del access_token de Keycloak si está disponible
      let keycloakClaims: any = {};
      if (account?.access_token) {
        try {
          const base64Payload = account.access_token.split('.')[1];
          const payload = Buffer.from(base64Payload, 'base64').toString('utf-8');
          keycloakClaims = JSON.parse(payload);
          console.log("=== DECODED KEYCLOAK ACCESS TOKEN EN JWT ===", keycloakClaims);
        } catch (e) {
          console.error("Error decodificando access_token:", e);
        }
      } else if (account?.id_token) {
        try {
          const base64Payload = account.id_token.split('.')[1];
          const payload = Buffer.from(base64Payload, 'base64').toString('utf-8');
          keycloakClaims = JSON.parse(payload);
          console.log("=== DECODED KEYCLOAK ID TOKEN EN JWT ===", keycloakClaims);
        } catch (e) {
          console.error("Error decodificando id_token:", e);
        }
      }

      if (account) {
        token.id_token = account.id_token;
        token.access_token = account.access_token;
      }

      if (user || Object.keys(keycloakClaims).length > 0) {
        const ud = keycloakClaims.userdata ? (typeof keycloakClaims.userdata === 'string' ? JSON.parse(keycloakClaims.userdata) : keycloakClaims.userdata) : keycloakClaims;
        
        const extractedOfficeId = ud.office_id || (user as any)?.office_id || (profile as any)?.office_id || token.office_id;
        
        let assignedRole = user?.email?.toLowerCase().includes("rrhh") || user?.email?.toLowerCase().includes("victor.castorani") ? "rrhh" : "empleado";

        // Si tenemos un ID de oficina, consultamos la API para verificar si pertenece a RRHH
        if (extractedOfficeId && !isNaN(Number(extractedOfficeId))) {
          try {
            const res = await fetch(`http://172.16.205.33:8000/api/catalogs/office/?id=${extractedOfficeId}`, {
              method: 'GET',
              headers: { 'Accept': 'application/json' }
            });
            if (res.ok) {
              const catalogData = await res.json();
              if (Array.isArray(catalogData) && catalogData.length > 0 && catalogData[0].description) {
                const desc = catalogData[0].description.toUpperCase().trim();
                if (desc.endsWith("DEL TALENTO HUMANO")) {
                  assignedRole = "rrhh";
                  console.log(`=== ROL RRHH ASIGNADO AUTOMÁTICAMENTE PARA LA OFICINA: ${desc} ===`);
                }
              }
            }
          } catch (err) {
            console.error("Error consultando el catálogo de oficinas para asignar rol:", err);
          }
        }

        token.role = assignedRole;
        token.cedula = ud.documentid || ud.cedula || (user as any)?.cedula || (profile as any)?.cedula || token.cedula;
        token.cargo = ud.position_id || ud.cargo || (user as any)?.cargo || (profile as any)?.cargo || token.cargo;
        token.given_name = ud.given_name || (user as any)?.given_name || (profile as any)?.given_name || token.given_name;
        token.family_name = ud.family_name || (user as any)?.family_name || (profile as any)?.family_name || token.family_name;
        token.fullname = ud.fullname || (user as any)?.fullname || (profile as any)?.fullname || token.fullname;
        token.documentid = ud.documentid || (user as any)?.documentid || (profile as any)?.documentid || token.documentid;
        token.office_id = extractedOfficeId;
        token.position_id = ud.position_id || (user as any)?.position_id || (profile as any)?.position_id || token.position_id;
        token.company_rif = ud.company_rif || (user as any)?.company_rif || (profile as any)?.company_rif || token.company_rif;
        token.assigned_systems = ud.assigned_systems || (user as any)?.assigned_systems || (profile as any)?.assigned_systems || token.assigned_systems;
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
        (session as any).id_token = token.id_token;
        (session as any).access_token = token.access_token;
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
