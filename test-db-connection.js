const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.cyftasxlrzuynzbrfgkd:Bangui2025@@@@aws-0-eu-west-3.pooler.supabase.com:5432/postgres?sslmode=no-verify'
});

client.connect(err => {
  if (err) {
    console.error('❌ Error de conexión:', err);
  } else {
    console.log('✅ Conexión exitosa');
    client.query('SELECT 1', (err, res) => {
      if (err) {
        console.error('❌ Error en consulta:', err);
      } else {
        console.log('✅ Consulta exitosa:', res.rows);
        client.end();
      }
    });
  }
});