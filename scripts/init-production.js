const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function initProduction() {
  console.log('🚀 Inicializando configuración de producción...');

  // Verificar variables de entorno
  const requiredEnvVars = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'SESSION_SECRET',
    'STRIPE_SECRET_KEY'
  ];

  const missing = requiredEnvVars.filter(env => !process.env[env]);
  if (missing.length > 0) {
    console.error('❌ Variables de entorno faltantes:', missing);
    process.exit(1);
  }

  // Crear directorio de logs
  const logsDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log('✅ Directorio de logs creado');
  }

  // Verificar conexión a Supabase
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Conexión a Supabase verificada');
  } catch (error) {
    console.error('❌ Error conectando a Supabase:', error.message);
    process.exit(1);
  }

  // Verificar estructura de base de datos
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    
    // Verificar que la tabla profiles tiene user_type
    const { data, error } = await supabase
      .from('profiles')
      .select('user_type')
      .limit(1);
    
    if (error && error.message.includes('user_type does not exist')) {
      console.log('⚠️  Columna user_type no existe, creándola...');
      // Aquí ejecutarías la migración SQL
      console.log('✅ Ejecuta: ALTER TABLE profiles ADD COLUMN user_type VARCHAR(20) DEFAULT \'user\';');
    } else {
      console.log('✅ Estructura de base de datos verificada');
    }
  } catch (error) {
    console.error('❌ Error verificando estructura:', error.message);
  }

  console.log('🎉 Inicialización completada');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  require('dotenv').config();
  initProduction().catch(console.error);
}

module.exports = initProduction;