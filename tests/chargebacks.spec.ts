import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3001";
const VALID_TRACKING = "TRACK123456";

test.describe("Chargeback API", () => {
  test.describe("Retrieval", () => {
    test("should return a single chargeback with correct structure", async ({
      request,
    }) => {
      const response = await request.get(
        `${BASE_URL}/v2/payments/tr_44aKxzEbr8/chargebacks/chb_n9z0tp`,
      );

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.resource).toBe("chargeback");
      expect(body.id).toBe("chb_n9z0tp");
      expect(body.reasonCode).toBe("item_not_received");
      expect(body.amount.currency).toBe("EUR");
      expect(body.respondBefore).toBeDefined();
    });

    test("should return a list of chargebacks for a payment", async ({
      request,
    }) => {
      const response = await request.get(
        `${BASE_URL}/v2/payments/tr_44aKxzEbr8/chargebacks`,
      );

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.count).toBe(2);
      expect(body._embedded.chargebacks).toHaveLength(2);
      expect(body._embedded.chargebacks[0].reasonCode).toBe("item_not_received");
      expect(body._embedded.chargebacks[1].reasonCode).toBe("fraudulent");
    });

    test("should return 404 for non-existent chargeback", async ({ request }) => {
      const response = await request.get(
        `${BASE_URL}/v2/payments/tr_44aKxzEbr8/chargebacks/chb_doesnotexist`,
      );

      expect(response.status()).toBe(404);
    });
  });

  test.describe("Evidence submission", () => {
    test("should successfully submit evidence with valid data", async ({
      request,
    }) => {
      const response = await request.post(
        `${BASE_URL}/v2/payments/tr_44aKxzEbr8/chargebacks/chb_n9z0tp/evidence`,
        {
          data: {
            trackingNumber: VALID_TRACKING,
            customerEmail: "customer@example.com",
            orderConfirmation: "order_2025_001.pdf",
          },
        },
      );

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.evidenceSubmitted).toBe(true);
      expect(body.status).toBe("evidence_submitted");
      expect(body.chargebackId).toBe("chb_n9z0tp");
      expect(body.submissionId).toMatch(/^evd_[a-z0-9]+$/);
      expect(body.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test("should reject evidence submission with empty body", async ({
      request,
    }) => {
      const response = await request.post(
        `${BASE_URL}/v2/payments/tr_44aKxzEbr8/chargebacks/chb_n9z0tp/evidence`,
      );

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Request body is required");
    });

    test("should reject evidence submission with missing tracking number", async ({
      request,
    }) => {
      const response = await request.post(
        `${BASE_URL}/v2/payments/tr_44aKxzEbr8/chargebacks/chb_n9z0tp/evidence`,
        {
          data: {
            orderConfirmation: "order_2025_001.pdf",
            customerEmail: "customer@example.com",
          },
        },
      );

      expect(response.status()).toBe(400);
    });

    test("should reject evidence submission with too-short tracking number", async ({
      request,
    }) => {
      const response = await request.post(
        `${BASE_URL}/v2/payments/tr_44aKxzEbr8/chargebacks/chb_n9z0tp/evidence`,
        {
          data: { trackingNumber: "ABC" },
        },
      );

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("trackingNumber");
    });

    test("should reject evidence submission with invalid email format", async ({
      request,
    }) => {
      const response = await request.post(
        `${BASE_URL}/v2/payments/tr_44aKxzEbr8/chargebacks/chb_n9z0tp/evidence`,
        {
          data: {
            trackingNumber: VALID_TRACKING,
            customerEmail: "not-an-email",
          },
        },
      );

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("customerEmail");
    });

    test("should reject oversized evidence payload", async ({ request }) => {
      const oversized = "a".repeat(2 * 1024 * 1024);
      const response = await request.post(
        `${BASE_URL}/v2/payments/tr_44aKxzEbr8/chargebacks/chb_n9z0tp/evidence`,
        {
          data: { trackingNumber: VALID_TRACKING, notes: oversized },
        },
      );

      expect(response.status()).toBe(413);
    });

    test("should reject evidence submission for chargeback past respondBefore deadline", async ({
      request,
    }) => {
      const response = await request.post(
        `${BASE_URL}/v2/payments/tr_44aKxzEbr8/chargebacks/chb_expired/evidence`,
        {
          data: { trackingNumber: VALID_TRACKING },
        },
      );

      expect(response.status()).toBe(422);
      const body = await response.json();
      expect(body.error).toContain("deadline");
      expect(body.respondBefore).toBeDefined();
    });
  });

  test.describe("Merchant risk", () => {
    test("should flag merchant with high chargeback ratio", async ({
      request,
    }) => {
      const response = await request.get(
        `${BASE_URL}/v2/merchants/merchant_001/chargeback-ratio`,
      );

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.chargebackRatio).toBeGreaterThan(body.threshold);
      expect(body.riskLevel).toBe("low");
      expect(body.warning).toBeDefined();
    });

    test("should reject merchant ratio query with invalid merchant ID format", async ({
      request,
    }) => {
      const response = await request.get(
        `${BASE_URL}/v2/merchants/not-a-merchant/chargeback-ratio`,
      );

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("format");
    });

    test("should return 404 for non-existent merchant", async ({ request }) => {
      const response = await request.get(
        `${BASE_URL}/v2/merchants/merchant_999/chargeback-ratio`,
      );

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toBe("Merchant not found");
    });
  });
});
