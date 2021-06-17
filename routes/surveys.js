const express = require("express");
const prisma = require("./db");
const router = express.Router();
const { getCurrentDate } = require("../helpers/dates");
const { successResponse, errorResponse } = require("../helpers/apiResponser");

router.post("/", process.middlewares, async (req, res) => {
    const { body } = req;
    try {
        let data = Object.assign({}, body);
        delete data.project_id;
        delete data.organization_id;

        data.project = { connect: { id: body.project_id } };
        data.organization = { connect: { id: body.organization_id } };

        var survey= await prisma.survey.create({
            data
        });

        return successResponse({
            res,
            body: survey,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({
            res,
            message: {
                en: "Survey could not be created, server error",
                es: "No se ha podido crear la noticia",
            },
            error,
        });
    } 
});

router.get("/projects/:pid", async (req, res) => {
    const { params } = req;
    try {
        const project_id = +params.pid;
        if (!Number.isInteger(project_id)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        const status = params.status;
        var queryParams = {};
        let where = { deleted: !true, project_id: project_id };
        const now = getCurrentDate();
        if (status === "available") {
            where.published = true;
            where.available_until = { lt: now };
        }
        queryParams.where = where;
        const surveys = await prisma.survey.findMany(queryParams);
        return successResponse({
            res,
            message: {
                en: "Survey listed succesfully",
                es: "Se han listado las noticias correctamente",
            },
            body: surveys,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

router.put("/:id", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const surveysId = +params.id;
        if (!Number.isInteger(surveysId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        let data = body;
        data.last_edit = getCurrentDate();

        const updated = await prisma.survey.update({
            where: { id: surveysId },
            data,
        });
        return successResponse({
            res,
            message: {
                en: "Survey updated succesfully",
                es: "Se han actualizado la encuesta correctamente",
            },
            body: updated,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

router.put("/:id/delete", async (req, res) => {
    const { params } = req;
    try {
        const surveysId = +params.id;
        if (!Number.isInteger(surveysId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        const now = getCurrentDate();
        const deleted = await prisma.survey.update({
            where: { id: surveysId },
            data: {
                deleted: true,
                deleted_at: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Survey deleted succesfully",
                es: "Se ha eliminado la noticia correctamente",
            },
            body: deleted,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({
            res,
            error,
        });
    } 
});

router.get("/:id", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const surveysId = params.id;
        var survey= await prisma.survey.findUnique({
            where: { id: surveysId },
        });
        if (survey) {
            return successResponse({
                res,
                message: {
                    en: "Survey listed succesfully",
                    es: "Se han listado las noticias correctamente",
                },
                body: survey,
            });
        } else {
            return errorResponse({
                res,
                message: {
                    en: "No surveys registered",
                    es: "No hay noticias registradas",
                },
                code: 404,
                error: "Error",
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

router.put("/:id/publish", async (req, res) => {
    const { params, body } = req;
    try {
        const surveysId = +params.id;
        if (!Number.isInteger(surveysId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        const now = getCurrentDate();
        const published = await prisma.survey.update({
            where: { id: surveysId },
            data: Object.assign(Object.assign({}, body.data), {
                published: true,
                posted_at: now,
            }),
        });
        return successResponse({
            res,
            message: {
                en: "Survey posted succesfully",
                es: "Se ha publicado la noticia correctamente",
            },
            body: published,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

router.post("/:id/duplicate", async (req, res) => {
    const { params } = req;
    try {
        const surveysId = +params.id;
        if (!Number.isInteger(surveysId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        var survey= await prisma.survey.findUnique({
            where: { id: surveysId },
        });
        if (!surveys) {
            return errorResponse({
                res,
                message: {
                    en: "No surveys registered with that id",
                    es: "No hay noticias registradas con ese id",
                },
                code: 404,
                error: "Error",
            });
        }
        let data = {};
        if (surveys) {
            data = Object.assign({}, surveys);
        }
        delete data.id;
        delete data.next_survey_id;
        data.project = {
            connect: { id: Number(data.project_id) },
        };
        data.organization = {
            connect: { id: Number(data.organization_id) },
        };

        delete data.project_id;
        delete data.organization_id;

        var survey= await prisma.survey.create({
            data
        });

        if (survey) {
            const questions = await prisma.question.findMany({
                where: { id: surveysId },
                select: {
                    project_id: true,
                    organization_id: true,
                    question_type_id: true,
                    required: true,
                    description: true,
                    settings: true,
                    options: true,
                    title: true,
                },
            });

            const copyQuestions = await Promise.all(
                questions.map(async (question) => {
                    let questionData = Object.assign(
                        Object.assign({}, question),
                        { created_at: getCurrentDate() }
                    );
                    questionData.project = {
                        connect: { id: question.project_id },
                    };
                    questionData.organization = {
                        connect: { id: question.organization_id },
                    };
                    questionData.survey = { connect: { id: survey.id } };
                    questionData.question_type = {
                        connect: { id: question.question_type_id },
                    };

                    delete questionData.project_id;
                    delete questionData.organization_id;
                    delete questionData.surveyId;
                    delete questionData.question_type_id;

                    return await prisma.question.create({
                        data: questionData,
                    });
                })
            );

            return successResponse({
                res,
                message: {
                    en: "Survey duplicated succesfully",
                    es: "La noticia se ha copiado exitosamente",
                },
                body: { survey, questions: copyQuestions },
            });
        } else {
            return errorResponse({
                res,
                message: {
                    en: "Survey could not be duplicated",
                    es: "No se ha podido duplicar la noticia",
                },
                error: "Error",
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

router.post("/:id/questions", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const surveyId = +params.id;
        if (!Number.isInteger(surveyId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        let data = Object.assign({}, body);

        delete data.project_id;
        delete data.organization_id;
        delete data.surveyId;
        delete data.question_type_id;

        data.project = { connect: { id: body.project_id } };
        data.organization = { connect: { id: body.organization_id } };
        data.survey = { connect: { id: surveyId } };
        data.question_type = { connect: { id: body.question_type_id } };

        const last_question = await prisma.question.findMany({
            where: { survey_id: surveyId },
            select: { order: true, id: true },
            take: 1,
            orderBy: { order: "desc" },
        });

        data.order = last_question.length > 0 ? last_question[0].order + 1 : 1;
        const question = await prisma.question.create({
            data,
        });

        return successResponse({
            res,
            body: question,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({
            res,
            message: {
                en: "Question could not be created, server error",
                es: "No se ha podido crear la pregunta",
            },
            error,
        });
    } 
});

//Route modified
router.put("/questions/:qid", async (req, res) => {
    const { params, body } = req;
    try {
        const questionId = +params.qid;
        if (!Number.isInteger(questionId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        let data = body;
        data.survey_id = data.surveyId;
        delete data.surveyId;
        const now = getCurrentDate();
        data.last_edit = now;

        const updated = await prisma.question.update({
            where: { id: questionId },
            data,
        });

        return successResponse({
            res,
            message: {
                en: "Question updated succesfully",
                es: "Se han actualizado la pregunta correctamente",
            },
            body: updated,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

//Route modified
router.put("/questions/:qid/delete", async (req, res) => {
    const { params } = req;
    try {
        const questionId = +params.qid;
        if (!Number.isInteger(questionId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        const now = getCurrentDate();
        const deleted = await prisma.question.update({
            where: { id: questionId },
            data: {
                deleted: true,
                deleted_at: now,
            },
        });

        return successResponse({
            res,
            message: {
                en: "Question deleted succesfully",
                es: "Se ha eliminado la pregunta correctamente",
            },
            body: deleted,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

router.get("/:id/questions", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const questionId = +params.id;
        if (!Number.isInteger(questionId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }

        const questions = await prisma.question.findMany({
            where: {
                deleted: !true,
                survey_id: questionId,
            },
            orderBy: { order: "asc" },
        });

        return successResponse({
            res,
            message: {
                en: "Questions listed succesfully",
                es: "Se han listado las preguntas de la encuesta correctamente",
            },
            body: questions,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Route modified
router.get("/questions/types", process.middlewares, async (req, res) => {
    try {
        const questionsTypes = await prisma.question_type.findMany({
            where: {
                deleted: !true,
            },
            orderBy: { id: "desc" },
        });

        return successResponse({
            res,
            message: {
                en: "Question types listed succesfully",
                es: "Se han listado los tipos de pregunta correctamente",
            },
            body: questionsTypes,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Route modified
router.get("/questions/:qid", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const questionId = +params.qid;
        if (!Number.isInteger(questionId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        const question = await prisma.question.findUnique({
            where: { id: questionId },
        });
        return successResponse({
            res,
            message: {
                en: "Question listed succesfully",
                es: "Se listó la pregunta correctamente",
            },
            body: question,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

//Route modified
router.put("/questions/:qid/order", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const questionId = +params.qid;
        if (!Number.isInteger(questionId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        const position = body.order;

        const currentQuestion = await prisma.question.findUnique({
            where: { id: questionId },
            select: { survey_id: true, id: true, order: true },
        });

        if (currentQuestion && currentQuestion.order) {
            const now = getCurrentDate();
            const updateQuestion = prisma.question.update({
                where: { id: questionId },
                data: { order: position, last_edit: now },
            });
            let updateQuery = ``;
            if (position < currentQuestion.order) {
                updateQuery += `UPDATE question set "order" = "order" + 1 WHERE "survey_id" = ${
                    currentQuestion === null || currentQuestion === void 0
                        ? void 0
                        : currentQuestion.survey_id
                } 
                and "order" >= ${position} and "order" < ${
                    currentQuestion.order
                } RETURNING *;`;
            } else {
                updateQuery += `UPDATE question set "order" = "order" - 1 WHERE "survey_id" = ${
                    currentQuestion === null || currentQuestion === void 0
                        ? void 0
                        : currentQuestion.survey_id
                } 
                and "order" <= ${position} and "order" > ${
                    currentQuestion.order
                } RETURNING *;`;
            }

            const updateOrders = prisma.$executeRaw(updateQuery);
            const [updatedOrders, updatedQuestion] = await prisma.$transaction([
                updateOrders,
                updateQuestion,
            ]);
            return successResponse({
                res,
                message: {
                    en: "Question updated succesfully",
                    es: "Se han actualizado la pregunta correctamente",
                },
                body: updatedQuestion,
            });
        } else {
            return errorResponse({
                res,
                error: "Invalid question id",
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

router.post("/:id/responses", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const surveyId = +params.id;
        if (!Number.isInteger(surveyId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        const searchUserReponse = await prisma.survey_answer.findUnique({
            where: {
                user_survey: { user_id: body.user_id, survey_id: surveyId },
            },
            include: { answer: true },
        });

        if (searchUserReponse) {
            return successResponse({
                res,
                body: searchUserReponse,
            });
        } else {
            let data = {};
            data.project = { connect: { id: body.project_id } };
            data.organization = { connect: { id: body.organization_id } };
            data.survey = { connect: { id: surveyId } };
            data.user = { connect: { id: body.user_id } };
            const surveyAnswer = await prisma.survey_answer.create({
                data,
            });
            await prisma.$executeRaw`UPDATE survey set participants = participants + 1 WHERE id = ${surveyId} RETURNING *;`;
            return successResponse({
                res,
                body: surveyAnswer,
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({
            res,
            message: {
                en: "Survey Response could not be created, server error",
                es: "No se ha podido crear la respuesta a la encuesta",
            },
            error,
        });
    } 
});

router.get("/:id/responses", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const surveyId = +params.id;
        if (!Number.isInteger(surveyId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        const surveyResponses = await prisma.survey_answer.findMany({
            where: { survey: { id: surveyId }, deleted: false },
            take: 100,
            cursor: body.offset,
            include: { answer: true, user: true },
        });

        return successResponse({
            res,
            message: {
                en: "Survey responses listed succesfully",
                es: "Se han listado las respuesta de la encuesta correctamente",
            },
            body: surveyResponses,
        });
    } catch (error) {
        return errorResponse({ res, error });
    } 
});

router.get("/responses/:rid/delete", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const surveysId = +params.rid;
        if (!Number.isInteger(surveysId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        const now = getCurrentDate();
        const deleted = await prisma.survey_answer.update({
            where: { id: surveysId },
            data: {
                deleted: true,
                deleted_at: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Survey response deleted succesfully",
                es: "Se ha eliminado la noticia correctamente",
            },
            body: deleted,
        });
    } catch (error) {
        return errorResponse({ res, error });
    } 
});

//Route modified. Is it used ?
router.get("/responses/:id", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const surveysId = params.id;
        var survey= await prisma.survey_answer.findUnique({
            where: { id: surveysId },
        });

        return successResponse({
            res,
            message: {
                en: "Survey response listed succesfully",
                es: "Se han listado la respuesta correctamente",
            },
            body: survey,
        });
    } catch (error) {
        return errorResponse({ res, error });
    } 
});

router.get("/:id/response", async (req, res) => {
    const { params, body } = req;
    try {
        const sub = req.currentUser.sub;
        const surveyId = +params.id;
        if (!Number.isInteger(surveyId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        if (!user) {
            return errorResponse({
                res,
                message: {
                    en: "User does not exists",
                    es: "No existe un usuario asociado",
                },
                code: 401,
                error: "Unauthorized",
            });
        }
        const userSurveyResponse = await prisma.survey.findUnique({
            where: { id: surveyId },
            select: {
                question: {
                    select: {
                        id: true,
                        title: true,
                        options: true,
                        question_type_id: true,
                        placeholder: true,
                    },
                },
                survey_answer: {
                    where: { survey_id: surveyId, user_id: user.id },
                    select: {
                        id: true,
                        answer: {
                            select: {
                                id: true,
                                response: true,
                                question_id: true,
                            },
                        },
                    },
                },
            },
        });

        return successResponse({
            res,
            message: {
                en: "User Survey response listed succesfully",
                es: "Se ha listado la respuesta del usuario correctamente",
            },
            body: userSurveyResponse,
        });
    } catch (error) {
        return errorResponse({ res, error });
    } 
});

router.post("/response/:rid/answers", async (req, res) => {
    const { params, body } = req;
    try {
        const responseId = +params.rid;
        if (!Number.isInteger(responseId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        const cognito = req.currentUser.sub;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: cognito },
        });
        let data = Object.assign({}, body);

        delete data.project_id;
        delete data.organization_id;
        delete data.response_id;
        delete data.resources;
        delete data.question_id;
        delete data.sub;

        data.project = { connect: { id: body.project_id } };
        data.organization = { connect: { id: body.organization_id } };
        data.survey_answer = { connect: { id: responseId } };
        data.question = { connect: { id: body.question_id } };

        const surveyAnswer = await prisma.answer.upsert({
            where: {
                answer_survey_answer_id_question_id_idx: {
                    survey_answer_id: responseId,
                    question_id: body.question_id,
                },
            },
            create: data,
            update: {
                response: data.response,
                completion_time: data.completion_time,
            },
        });

        if (body.resources) {
            body.resources.forEach(async (resource_id) => {
                await prisma.user_resource.upsert({
                    where: {
                        user_resource_user_id_resource_id_idx1: {
                            user_id: user.id,
                            resource_id: resource_id,
                        },
                    },
                    create: {
                        user: { connect: { id: user.id } },
                        resources: { connect: { id: resource_id } },
                        project: { connect: { id: body.project_id } },
                        organization: { connect: { id: body.organization_id } },
                    },
                    update: {
                        resources: { connect: { id: resource_id } },
                    },
                });
            });
        }

        return successResponse({
            res,
            body: surveyAnswer,
        });
    } catch (error) {
        console.log(error);
        return errorResponse({
            res,
            message: {
                en: "Survey Response answer could not be created",
                es: "No se ha podido crear la respuesta a la pregunta de la encuesta",
            },
            error,
        });
    } 
});

//Route modified
router.put("/answers/:id", async (req, res) => {
    const { params, body } = req;
    try {
        const surveysResponseId = +params.id;
        if (!Number.isInteger(surveysResponseId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        const now = getCurrentDate();
        let data = Object.assign({ last_edit: now }, body);

        const updated = await prisma.answer.update({
            where: { id: surveysResponseId },
            data,
        });

        return successResponse({
            res,
            message: {
                en: "Answer updated succesfully",
                es: "Se ha actualizado la respuesta correctamente",
            },
            body: updated,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({
            res,
            error,
        });
    } 
});

//Route modified
router.put("/respons/:id/answers", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const surveysResponseId = +params.id;
        if (!Number.isInteger(surveysResponseId)) {
            return errorResponse({ res, error: "Id is not valid" });
        }
        const user = await prisma.user.findUnique({
            where: { cognito_sub: body.sub },
        });
        if (!user) {
            return errorResponse({
                res,
                message: {
                    en: "User does not exists",
                    es: "No existe un usuario asociado",
                },
                error: "Unauthorized",
                code: 401,
            });
        }
        const { answers } = body;
        const updated = await Promise.all(
            answers.map(async (answer) => {
                const userAnswer = await prisma.answer.update({
                    where: {
                        answer_survey_answer_id_question_id_idx: {
                            survey_answer_id: surveysResponseId,
                            question_id: answer.question_id,
                        },
                    },
                    data: {
                        response: answer.response,
                    },
                });
                if (answer.resources) {
                    answer.resources.forEach(async (resource_id) => {
                        await prisma.user_resource.upsert({
                            where: {
                                user_resource_user_id_resource_id_idx1: {
                                    user_id: user.id,
                                    resource_id: resource_id,
                                },
                            },
                            create: {
                                user: { connect: { id: user.id } },
                                resources: { connect: { id: resource_id } },
                                project: {
                                    connect: { id: userAnswer.project_id },
                                },
                                organization: {
                                    connect: { id: userAnswer.organization_id },
                                },
                            },
                            update: {
                                resources: { connect: { id: resource_id } },
                            },
                        });
                    });
                    return userAnswer;
                }
            })
        );

        return successResponse({
            res,
            message: {
                en: "survey Answer updated succesfully",
                es: "Se han actualizado la respuestas del survey correctamente",
            },
            body: updated,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

module.exports = router;
