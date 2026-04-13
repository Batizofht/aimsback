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



/*====================================PRODUCTION SUPABASE==================================================*/
// export const meintoyouapp = new Sequelize('postgresql://postgres.rcjppgpnfjgobbdcptst:GODis900d(yes-heIS)@aws-1-eu-west-3.pooler.supabase.com:5432/postgres', {
//   dialect: "postgres",
//   dialectOptions: {
//     ssl: {
//       require: true,
//       rejectUnauthorized: false,
//     },
//   },
//   logging: false,
// });




export default meintoyouapp;

