import Game from "../models/games.js";
import User from "../models/users.js";
import QuizTopic from "../models/QuizTopic.js";
import QuizQuestion from "../models/QuizQuestion.js";
import {sequelize} from "../bdd.js";

export async function createGame(userId) {
    if (!userId) {
        return {error: "L'identifiant du joueur est manquant"};
    }
    const datas = await Game.create({creator: userId});
    console.log(datas.dataValues.id);
    return {gameId: datas.dataValues.id};
}

/**
 * Fonction qui démarre le quiz en sélectionnant un sujet aléatoire
 * et en récupérant 10 questions associées.
 */
export async function startQuizGame(gameId) {
    // Récupérer tous les sujets disponibles
    const topics = await QuizTopic.findAll();
    if (!topics || topics.length === 0) {
        return {error: "Aucun sujet de quiz disponible."};
    }
    // Sélectionner un sujet aléatoire
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    // Récupérer 10 questions aléatoires associées à ce sujet
    const questions = await QuizQuestion.findAll({
        where: {topicId: randomTopic.id},
        order: sequelize.random(),
        limit: 10,
    });
    return {topic: randomTopic, questions};
}

export async function updateGame(request) {
    console.log(request.params);
    const userId = request.body.userId;

    if (!request.params || !request.params.action || !request.params.gameId) {
        return {error: "Il manque des paramètres"};
    }
    const {action, gameId} = request.params;
    if (!userId) {
        return {error: "L'identifiant du joueur est manquant"};
    }
    const game = await Game.findByPk(gameId);
    if (!game) {
        return {error: "La partie n'existe pas."};
    }

    if (game.dataValues.state === "finished") {
        return {error: "Cette partie est déjà terminée !"};
    }

    let quizData = null;
    switch (action) {
        case "join":
            if (game.dataValues.player != null) {
                return {error: "Il y a déjà 2 joueurs dans cette partie !"};
            }
            if (game.dataValues.state !== "pending") {
                return {error: "Cette partie n'est plus en attente."};
            }
            await game.setPlayer2(userId);
            break;

        case "start":
            // Démarrage classique de la partie
            game.state = "playing";
            break;

        case "startQuiz":
            // Démarrer la partie en mode quiz
            game.state = "playing";
            quizData = await startQuizGame(gameId);
            if (quizData.error) {
                return {error: quizData.error};
            }
            break;

        case "finish":
            game.state = "finished";
            if (!request.body.score) {
                return {error: "Le score est manquant."};
            }
            game.winnerScore = request.body.score;
            game.winner = request.body.winner;
            break;

        default:
            return {error: "Action inconnue"};
    }
    await game.save();
    if (quizData) {
        return {game, quizData};
    }
    return game;
}

export async function getGames() {
    try {
        return await Game.findAll({
            include: [
                {model: User, as: "player1", attributes: ["id", "username"]},
                {model: User, as: "player2", attributes: ["id", "username"]},
                {model: User, as: "winPlayer", attributes: ["id", "username"]}
            ]
        });
    } catch (error) {
        return { error: error.message };
    }
}
