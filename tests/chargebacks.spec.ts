import { test, expect } from '@playwright/test'; 
import { request } from 'node:http';

const BASE_URL = 'http://localhost:3001';

test.describe('Chargeback API', () => { 

    test('should return a single chargeback with correct structure', async ({request}) => {
        const response = await request.get(
            `${BASE_URL}/v2/payments/tr_44aKxzEbr8/chargebacks/chb_n9z0tp`
        );

            expect(response.status()).toBe(200);

            const body = await response.json(); 
            expect(body.resource).toBe('chargeback'); 
            expect(body.id).toBe('chb_n9z0tp');  
            expect(body.reasonCode).toBe('item_not_received'); 
            expect(body.amount.currency).toBe('EUR'); 
            expect(body.respondBefore).toBeDefined();  

        });

        test('should return a list of chargebacks for a payment', async ({request}) => {
            const response = await request.get( 
                `${BASE_URL}/v2/payments/tr_44aKxzEbr8/chargebacks` 
            ); 

            expect(response.status()).toBe(200); 

            const body = await response.json(); 
            expect(body.count).toBe(2);
            expect(body._embedded.chargebacks).toHaveLength(2); 
            expect(body._embedded.chargebacks[0].reasonCode).toBe('item_not_received'); 
            expect(body._embedded.chargebacks[1].reasonCode).toBe('fraudulent');
            
        }); 

        test('should flag merchant with high chargeback ratio', async ({request}) => { 
            const response = await request.get(  
                `${BASE_URL}/v2/merchants/merchant_001/chargeback-ratio`
            ); 

            expect(response.status()).toBe(200);  

            const body = await response.json(); 
            expect(body.chargebackRatio).toBeGreaterThan(body.threshold);
            expect(body.riskLevel).toBe('high'); 
            expect(body.warning).toBeDefined();  
            
        
    });
});
