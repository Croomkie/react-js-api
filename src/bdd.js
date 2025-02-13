import { Sequelize } from "@sequelize/core";
import { MySqlDialect } from "@sequelize/mysql";
import dotenv from "dotenv";

dotenv.config();

/**
 * Connexion à la base de données
 */
export const sequelize = new Sequelize({
	dialect: MySqlDialect,
	url: 'mysql://root:oTjIMohQCUFHLvPpCHLVxYLQaTkyUTAB@roundhouse.proxy.rlwy.net:26965/railway',
});
