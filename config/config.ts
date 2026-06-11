import { Sequelize } from "sequelize";
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

/* ================================ REPLACE WITH THE SUPABASE CONNECTION STRING ============== */

// export const meintoyouapp = new Sequelize('postgresql://postgres:ASDCADSCASDCSADC@db.jbdmaoohlspxdlpntxhb.supabase.co:5432/postgres', {
//   dialect: "postgres",
//   dialectOptions: {
//     ssl: {
//       require: true,
//       rejectUnauthorized: false,
//     },
//   },
//   logging: false,
// });



/*====================================PRODUCTION SUPABASE==================================================*/

export const db = new Sequelize('postgresql://postgres.cpwffobowtoxazgfykhz:dssdsddsdsdsdsdsdsdsdsds@aws-0-eu-west-1.pooler.supabase.com:6543/postgres', {
  dialect: "postgres",
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: false,
});





export default db;

