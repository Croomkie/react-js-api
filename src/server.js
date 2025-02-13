import chalk from "chalk";
//pour fastify
import fastify from "fastify";
import fastifyBcrypt from "fastify-bcrypt";
import cors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyJWT from "@fastify/jwt";
import socketioServer from "fastify-socket.io";
//routes
import {usersRoutes} from "./routes/users.js";
import {gamesRoutes} from "./routes/games.js";
//bdd
import {sequelize} from "./bdd.js";
import {startQuizGame} from "./controllers/games.js";
import Game from "./models/games.js";


//Test de la connexion
try {
    sequelize.authenticate();
    console.log(chalk.grey("Connecté à la base de données MySQL!"));
} catch (error) {
    console.error("Impossible de se connecter, erreur suivante :", error);
}

/**
 * API
 * avec fastify
 */
let blacklistedTokens = [];
const app = fastify();
//Ajout du plugin fastify-bcrypt pour le hash du mdp
await app
    .register(fastifyBcrypt, {
        saltWorkFactor: 12,
    })
    .register(cors, {
        origin: "*",
    })
    .register(fastifySwagger, {
        openapi: {
            openapi: "3.0.0",
            info: {
                title: "Documentation de l'API JDR LOTR",
                description:
                    "API développée pour un exercice avec React avec Fastify et Sequelize",
                version: "0.1.0",
            },
        },
    })
    .register(fastifySwaggerUi, {
        routePrefix: "/documentation",
        theme: {
            title: "Docs - JDR LOTR API",
        },
        uiConfig: {
            docExpansion: "list",
            deepLinking: false,
        },
        uiHooks: {
            onRequest: function (request, reply, next) {
                next();
            },
            preHandler: function (request, reply, next) {
                next();
            },
        },
        staticCSP: true,
        transformStaticCSP: (header) => header,
        transformSpecification: (swaggerObject, request, reply) => {
            return swaggerObject;
        },
        transformSpecificationClone: true,
    })
    .register(fastifyJWT, {
        secret: "unanneaupourlesgouvernertous",
    });
/**********
 * Routes
 **********/
app.get("/", (request, reply) => {
    reply.send({documentationURL: "http://localhost:3000/documentation"});
});
// Fonction pour décoder et vérifier le token
app.decorate("authenticate", async (request, reply) => {
    try {
        const token = request.headers["authorization"].split(" ")[1];

        // Vérifier si le token est dans la liste noire
        if (blacklistedTokens.includes(token)) {
            return reply
                .status(401)
                .send({error: "Token invalide ou expiré"});
        }
        await request.jwtVerify();
    } catch (err) {
        reply.send(err);
    }
});
//gestion utilisateur
usersRoutes(app);
//gestion des jeux
gamesRoutes(app);

/**********
 * START
 **********/
const start = async () => {
    try {
        await sequelize
            .sync({alter: true})
            .then(() => {
                console.log(chalk.green("Base de données synchronisée."));
            })
            .catch((error) => {
                console.error(
                    "Erreur de synchronisation de la base de données :",
                    error
                );
            });
        await app.listen({ port: parseInt(process.env.PORT) || 3000, host: '0.0.0.0' });
        console.log(
            "Serveur Fastify lancé sur " + chalk.blue("http://localhost:3000")
        );
        console.log(
            chalk.bgYellow(
                "Accéder à la documentation sur http://localhost:3000/documentation"
            )
        );
    } catch (err) {
        console.log(err);
        process.exit(1);
    }
};


/**********
 * SOCKET IO
 **********/

await app.register(socketioServer, {
    cors: {
        origin: "*",
        credentials: true
    }
});

// Objet en mémoire pour stocker l'état des parties
const games = {};

app.io.on("connection", (socket) => {
    console.log("Nouveau joueur connecté:", socket.id);

    // Lorsqu'un joueur rejoint une partie
    socket.on("joinGame", ({ gameId, user }) => {
        // Initialisation de l'état de la partie s'il n'existe pas
        if (!games[gameId]) {
            games[gameId] = {
                players: [],
                quiz: null, // contiendra { topic, questions, currentQuestionIndex }
                scores: {}
            };
        }
        // Ajout du joueur s'il n'est pas déjà présent
        if (!games[gameId].players.some((player) => player.id === user.id)) {
            games[gameId].players.push(user);
        }
        socket.join(gameId);
        console.log(`${user.username} a rejoint la partie ${gameId}`);
        // Diffuse la liste actualisée des joueurs à tous les clients de la room
        app.io.to(gameId).emit("updatePlayers", games[gameId].players);
    });

    // Permet de récupérer l'état actuel de la partie en cas de refresh
    socket.on("getGameState", ({ gameId }) => {
        const state = games[gameId] || { players: [], quiz: null, scores: {} };
        socket.emit("gameState", state);
    });

    // Lancement du quiz
    socket.on("startQuiz", async ({ gameId }) => {
        try {
            const quizData = await startQuizGame(gameId);
            if (quizData.error) {
                socket.emit("quizError", { error: quizData.error });
                return;
            }
            // Stocker l'état du quiz dans la partie
            games[gameId].quiz = {
                topic: quizData.topic,
                questions: quizData.questions,
                currentQuestionIndex: 0
            };
            // Réinitialiser les scores
            games[gameId].scores = {};
            // Envoyer la première question et le sujet à tous les clients dans la room
            const firstQuestion = quizData.questions[0];
            app.io.to(gameId).emit("quizStarted", { topic: quizData.topic, question: firstQuestion });
        } catch (err) {
            console.error("Erreur lors du démarrage du quiz :", err);
            socket.emit("quizError", { error: "Erreur lors du démarrage du quiz" });
        }
    });

    // Traitement de la réponse d'un joueur
    socket.on("submitAnswer", ({ gameId, answer, userId }) => {
        const game = games[gameId];
        if (!game || !game.quiz) return; // Aucun quiz en cours

        const { questions, currentQuestionIndex } = game.quiz;
        const currentQuestion = questions[currentQuestionIndex];
        const isCorrect = answer === currentQuestion.correctAnswer;

        // Mettre à jour le score du joueur
        if (!game.scores[userId]) game.scores[userId] = 0;
        if (isCorrect) {
            game.scores[userId] += 1;
        }

        // Notifier tous les joueurs avec les scores mis à jour
        app.io.to(gameId).emit("answerResult", { scores: game.scores });

        // Vérifier s'il reste des questions
        if (currentQuestionIndex + 1 < questions.length) {
            game.quiz.currentQuestionIndex++;
            const nextQuestion = questions[game.quiz.currentQuestionIndex];
            app.io.to(gameId).emit("nextQuestion", { question: nextQuestion });
        } else {
            // Fin du quiz : déterminer le gagnant
            let winnerId = null;
            let winnerScore = -1;
            Object.entries(game.scores).forEach(([uid, score]) => {
                if (score > winnerScore) {
                    winnerScore = score;
                    winnerId = uid;
                }
            });

            // Mettre à jour la partie dans la base de données
            Game.findByPk(gameId)
                .then((gameRecord) => {
                    if (gameRecord) {
                        gameRecord.winner = winnerId;
                        gameRecord.winnerScore = winnerScore;
                        gameRecord.state = "finished";
                        return gameRecord.save();
                    }
                })
                .then(() => {
                    console.log("La partie a été mise à jour avec le gagnant:", winnerId);
                })
                .catch((err) => console.error("Erreur lors de la mise à jour de la partie", err));

            // Envoyer l'événement de fin de quiz aux joueurs
            app.io.to(gameId).emit("quizEnded", { scores: game.scores });
        }
    });

    socket.on("disconnect", () => {
        console.log("Client déconnecté:", socket.id);
        // Vous pouvez ajouter ici la logique pour retirer le joueur de toutes les parties, etc.
    });
});



start();
