import { Sequelize } from "sequelize";

/* ================================ REPLACE WITH THE SUPABASE CONNECTION STRING ============== */

export const meintoyouapp = new Sequelize('postgresql://postgres.jbdmaoohlspxdlpntxhb:EWFQFWREFGWEFGWRFGWERRWEFGWREFW@aws-1-us-east-2.pooler.supabase.com:6543/postgres', {
  dialect: "postgres",
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: false,
});




/* ================================ HERE IS THE CONFIG ONCE YOU ARE USING REAL PGADMIN OR VPS CONFIG ============== */

// export const meintoyouapp = new Sequelize({
//   username: "stigesfo_batizo",
//   password: "jkasjkasjkkjhxckjlbcljEBCJHBCEJHBqechbqjkhcbkljwcxn;WCNLej212123..33@@ihcbLJIQWCNjilcbnILQJCBKCBJH",
//   database: "stigesfo_sihsportal",
//   port: 5432,
//   dialect: "postgres",
//   logging: false,
//   host: "127.0.0.1",
// });

// Export it so that it can be exposed outside this file and directory
export default meintoyouapp;

