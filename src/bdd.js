import { Sequelize } from "@sequelize/core";
import { MySqlDialect } from "@sequelize/mysql";
import dotenv from "dotenv";

dotenv.config();

/**
 * Connexion à la base de données
 */
export const sequelize = new Sequelize({
	dialect: MySqlDialect,
	url: process.env.MYSQL_ADDON_URI || 'mysql://root:oTjIMohQCUFHLvPpCHLVxYLQaTkyUTAB@roundhouse.proxy.rlwy.net:26965/railway',
});

//mysql://uijjlicdxqnssr2a:UN1ZVTiZ0VgDYW6hQCjJ@br1fanb5glatx6ktotzm-mysql.services.clever-cloud.com:3306/br1fanb5glatx6ktotzm