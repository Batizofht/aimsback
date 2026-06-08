import { Sequelize } from "sequelize";

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
export const db = new Sequelize('postgresql://postgres:dssdsddsdsdsdsdsdsdsdsds@db.cpwffobowtoxazgfykhz.supabase.co:5432/postgres', {
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

