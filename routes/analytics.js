const express = require("express");
const prisma = require("./db");
const router = express.Router();
const dates = require("../helpers/dates");
const { successResponse, errorResponse } = require("../helpers/apiResponser");

//Analytics Helpers
//Get question count
const getQuestionCount = async (id, color) => {
    const question = await prisma.question.findUnique({
        where: { id: id },
        select: { id: true, options: true, title: true },
    });
    const categoryData = {
        category: question ? question.title : "",
        value: 0,
        color: color,
        data: [],
    };
    let data = [];
    if (!question) {
        return [];
    }
    await Promise.all(
        question.options.map(async (opt) => {
            const option = opt;
            if (option.next_question_id) {
                const answers = await prisma.answer.findMany({
                    where: { question_id: option.next_question_id },
                });
                data.push({
                    name: option.title,
                    value: answers.length,
                });
                categoryData.value = categoryData.value + answers.length;
            }
        })
    );
    categoryData.data = data.sort(
        (firstEl, secondEl) => secondEl.value - firstEl.value
    );
    return categoryData;
};

//count array method
const count = (arr) =>
    arr.reduce((ac, a) => ((ac[a] = ac[a] + 1 || 1), ac), {});

//End Helpers

//Create analytics
router.post("/projects/:id", process.middlewares, async (req, res) => {
    try {
        const projectId = +req.params.id;
        if (!Number.isInteger(projectId)) {
            throw new Error("Missing integer id");
        }
        const event = req.body;
        const now = dates.getCurrentDate();
        let data = Object.assign(Object.assign({}, event), {
            created_at: now,
        });
        delete data.author_id;
        delete data.project_id;
        delete data.organization_id;
        data.author = { connect: { id: event.author_id } };
        data.project = { connect: { id: projectId } };
        data.organization = { connect: { id: event.organization_id } };
        const result = await prisma.analytics.create({
            data,
        });
        return successResponse({ res, body: result });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        await prisma.$disconnect();
    }
});

//LaunchSA analytcis
router.get("/launchsa", process.middlewares, async (req, res) => {
    try {
        let BAR_BY_CATEGORY = [];
        BAR_BY_CATEGORY.push(await getQuestionCount(124, "#29304D"));
        BAR_BY_CATEGORY.push(await getQuestionCount(125, "#003F4F"));
        BAR_BY_CATEGORY.push(await getQuestionCount(126, "#6DFFE2"));
        const sComplicated = await prisma.answer.count({
            where: {
                question_id: 127,
            },
        });
        BAR_BY_CATEGORY.push({
            category: "Something More Complicated",
            value: sComplicated,
            color: "#12D5C3",
        });
        const bussiness = await prisma.answer.findMany({
            where: { question_id: 119 },
            select: { response: true },
        });
        const reduceBussiness = bussiness.map((answer) => {
            const response = answer.response;
            if (response["119"] && response["119"].length > 0) {
                return response["119"][0];
            }
        });
        const countResponses = count(reduceBussiness);
        let PIE_BY_CATEGORY = [];
        let responsesCount = 0;
        for (const [key, value] of Object.entries(countResponses)) {
            responsesCount++;
            PIE_BY_CATEGORY.push({
                id: key,
                label: key,
                value: value / bussiness.length,
                color:
                    responsesCount % 1
                        ? "#6DFFE2"
                        : responsesCount % 2
                        ? "#4CCEB8"
                        : "#003F4F",
            });
        }
        const totalConversations = await prisma.mail.count({
            where: { project_id: 37 },
        });
        const newConversations = await prisma.mail.findMany({
            where: { project_id: 37 },
            distinct: ["author_id"],
            select: { id: true },
        });
        return successResponse({
            res,
            body: {
                BAR_BY_CATEGORY,
                PIE_BY_CATEGORY,
                total_logins: 10,
                total_conversation: totalConversations,
                new_chat: newConversations.length,
            },
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        await prisma.$disconnect();
    }
});

module.exports = router;
