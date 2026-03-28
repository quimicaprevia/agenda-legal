-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Juicio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nro" TEXT,
    "autos" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "fuero" TEXT,
    "juzgado" TEXT,
    "secretaria" TEXT,
    "sala" TEXT,
    "cosasRelevantes" TEXT,
    "advertencia" TEXT,
    "driveUrl" TEXT,
    "iaUrl" TEXT,
    "pjnUrl" TEXT,
    "datosJuzgado" TEXT,
    "datosContacto" TEXT,
    "otraInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Juicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "juicioId" TEXT,
    "asuntoId" TEXT,
    "texto" TEXT NOT NULL,
    "fecha" TIMESTAMP(3),
    "urgente" BOOLEAN NOT NULL DEFAULT false,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "tipo" TEXT,
    "tema" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prueba" (
    "id" TEXT NOT NULL,
    "juicioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "contenido" TEXT,
    "descripcion" TEXT,
    "detalle" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Ofrecida',
    "vencimiento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prueba_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Honorario" (
    "id" TEXT NOT NULL,
    "juicioId" TEXT NOT NULL,
    "clienteContraparte" TEXT,
    "total" TEXT,
    "pagado" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Pendiente',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Honorario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asunto" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Abierta',
    "advertencia" TEXT,
    "otraInfo" TEXT,
    "driveUrl" TEXT,
    "webUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteJuicio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "juicioId" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "dni" TEXT,
    "correo" TEXT,
    "telefono" TEXT,
    "domicilio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClienteJuicio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Juicio" ADD CONSTRAINT "Juicio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_juicioId_fkey" FOREIGN KEY ("juicioId") REFERENCES "Juicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_asuntoId_fkey" FOREIGN KEY ("asuntoId") REFERENCES "Asunto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prueba" ADD CONSTRAINT "Prueba_juicioId_fkey" FOREIGN KEY ("juicioId") REFERENCES "Juicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Honorario" ADD CONSTRAINT "Honorario_juicioId_fkey" FOREIGN KEY ("juicioId") REFERENCES "Juicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asunto" ADD CONSTRAINT "Asunto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteJuicio" ADD CONSTRAINT "ClienteJuicio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteJuicio" ADD CONSTRAINT "ClienteJuicio_juicioId_fkey" FOREIGN KEY ("juicioId") REFERENCES "Juicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
