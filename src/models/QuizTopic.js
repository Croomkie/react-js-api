// models/QuizTopic.js
import { DataTypes } from "@sequelize/core";
import { sequelize } from "../bdd.js";

const QuizTopic = sequelize.define("quiz_topic", {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
});

export default QuizTopic;
