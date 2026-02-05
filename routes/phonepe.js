const express = require('express');
const { randomUUID } = require("crypto");
const dotenv = require('dotenv');
const { StandardCheckoutClient, Env, StandardCheckoutPayRequest } = require("pg-sdk-node");

dotenv.config();

const router = express.Router();

// Configuration - you might want to move these to a config file

// const clientId = "TEST-M23S3HUTWUE4X_25060";
// const clientSecret = "ZTJiMTgyMWEtNmVjOS00YjFmLTlkZjktNTIzMTU1YTFkNmY3";
// const env = Env.SANDBOX; 
// const clientVersion = 1;

const clientId = "SU2506101440411575886351";
const clientSecret = "27af475c-3c36-4359-aea5-7ac09a6db8fa";
const env = Env.PRODUCTION;
const clientVersion = 1;

const client = StandardCheckoutClient.getInstance(clientId, clientSecret, clientVersion, env);

router.post('/create-order', async (req, res) => {
    try {
        const { amount, currency } = req.body;

        if (!amount || !currency) {
            return res.status(400).send("Amount and currency are required");
        }

        const merchantOrderId = randomUUID();
        // console.log("Creating order with ID:", merchantOrderId);


        const request = StandardCheckoutPayRequest.builder()
            .merchantOrderId(merchantOrderId)
            .amount(amount)
            .build();

        const response = await client.pay(request);

        return res.json({
            checkoutPageUrl: response.redirectUrl,
            merchantOrderId: merchantOrderId
        });

    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).send("Error creating order");
    }
});


router.get('/check-status', async (req, res) => {
    try {
        const { merchantOrderId } = req.query;

        if (!merchantOrderId) {
            return res.status(400).send("merchantOrderId is required");
        }

        const response = await client.getOrderStatus(merchantOrderId);
        const status = response.state;

        // console.log(`Status for ${merchantOrderId}:`, status);

        return res.json({
            merchantOrderId,
            status
        });

    } catch (error) {
        console.error("Error checking status:", error);
        res.status(500).send("Error getting status");
    }
});


module.exports = router;