import GoogleProvider from "next-auth/providers/google"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user }: any) {
      if (!user.email) return false
      await prisma.user.upsert({
        where: { email: user.email },
        update: { name: user.name, image: user.image },
        create: { email: user.email, name: user.name, image: user.image },
      })
      return true
    },
    async session({ session }: any) {
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } })
        if (dbUser) session.user.id = dbUser.id
      }
      return session
    },
  },
}
