// models/QuizQuestion.js
import { DataTypes } from "@sequelize/core";
import { sequelize } from "../bdd.js";
import QuizTopic from "./QuizTopic.js";

const QuizQuestion = sequelize.define("quiz_question", {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    question: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    answerA: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    answerB: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    answerC: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    answerD: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    // On peut stocker la lettre de la bonne réponse (par exemple "A", "B", "C", "D")
    correctAnswer: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

// Association : une question appartient à un sujet
QuizQuestion.belongsTo(QuizTopic, {
    foreignKey: "topicId",
    as: "topic",
});

// Et un sujet a plusieurs questions
QuizTopic.hasMany(QuizQuestion, {
    foreignKey: "topicId",
    as: "questions",
});

export default QuizQuestion;
