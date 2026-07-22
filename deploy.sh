#!/bin/bash
echo "🚀 Iniciando despliegue de SudeParking..."

# 1. Traer los últimos cambios
echo "📥 Descargando código de Git..."
git pull origin main

# 2. Instalar dependencias nuevas (si las hay)
echo "📦 Instalando dependencias..."
npm install

# 3. Construir la aplicación
echo "🏗️ Compilando Next.js..."
npm run build

# 4. Reiniciar PM2 sin tiempo de inactividad
echo "🔄 Reiniciando aplicación con PM2..."
pm2 reload sude-parking-web || pm2 start ecosystem.config.js

echo "✅ ¡Despliegue completado con éxito!"
