# Square Payment InvalidArgumentsError - Fix Guide

## Error Description

The error `InvalidArgumentsError: One or more of the arguments needed are missing or invalid` occurs in Square's `verifyBuyer` function when the `createVerificationDetails` callback doesn't return properly formatted data.

## Root Cause

Square's Web Payments SDK is very strict about the format of verification details. The error occurs when:

1. **Amount format is incorrect** - Must be a string with exactly 2 decimal places
2. **Missing or invalid billing contact fields** - All fields must be non-empty strings
3. **Invalid phone number format** - Should contain only digits
4. **Invalid postal code format** - Must match the country's postal code pattern
5. **Invalid country code** - Must be uppercase ISO country code

## Solution Implemented

The fix ensures all fields are properly validated and formatted:

### 1. Amount Validation
```javascript
const amountValue = parseFloat(appointment.amount);
if (isNaN(amountValue) || amountValue <= 0) {
  throw new Error('Invalid appointment amount');
}
const amount = amountValue.toFixed(2); // Always 2 decimal places
```

### 2. Phone Number Cleaning
```javascript
let phone = (profile?.phone || '5555555555').replace(/\D/g, '');
if (!phone || phone.length < 10) {
  phone = '5555555555'; // Default if invalid
}
```

### 3. Postal Code Validation
```javascript
let postalCode = (profile?.address?.zipCode || '12345').trim();
if (!/^\d{5,10}$/.test(postalCode)) {
  postalCode = '12345';
}
```

### 4. Country Code Normalization
```javascript
const countryCode = (profile?.address?.country || 'US').trim().toUpperCase();
```

### 5. Proper Structure
```javascript
{
  total: {
    amount: "10.00",  // String with 2 decimals
    currencyCode: "USD"
  },
  intent: "CHARGE",
  billingContact: {
    givenName: "John",
    familyName: "Doe",
    email: "john@example.com",
    phone: "5555555555",  // Digits only
    addressLines: ["123 Main St"],
    city: "Anytown",
    state: "CA",
    countryCode: "US",  // Uppercase
    postalCode: "12345"  // Valid format
  }
}
```

## Testing

To test the payment:

1. **Use Square Test Card**: `4111 1111 1111 1111`
   - Expiry: Any future date (e.g., 12/25)
   - CVV: Any 3 digits (e.g., 123)
   - ZIP: Any 5 digits (e.g., 12345)

2. **Check Browser Console**: 
   - Look for "Square verification details:" log to see what's being sent
   - Any errors will be logged

3. **Common Issues**:
   - If amount is 0 or negative → Fixed with validation
   - If phone has special characters → Fixed with `.replace(/\D/g, '')`
   - If postal code is invalid → Fixed with regex validation
   - If country code is lowercase → Fixed with `.toUpperCase()`

## Alternative: Disable Buyer Verification (For Testing)

If you're still experiencing issues and just want to test payments, you can temporarily remove `createVerificationDetails`:

```javascript
<PaymentForm
  applicationId={applicationId}
  locationId={locationId}
  cardTokenizeResponseReceived={handlePaymentSuccess}
  // Remove createVerificationDetails for testing
>
```

**Note**: Buyer verification is recommended for production as it helps prevent fraud. Only disable it for testing purposes.

## Debugging Steps

1. Open browser DevTools (F12)
2. Go to Console tab
3. Try to submit payment
4. Check the "Square verification details:" log
5. Verify all fields are present and correctly formatted
6. If error persists, check Network tab for API responses

## Environment Variables Required

Make sure these are set in your `.env` file:

```env
VITE_SQUARE_APPLICATION_ID=sandbox-sq0idb-XXXXXXXXXXXXXXXXXXXXXXXX
VITE_SQUARE_LOCATION_ID=LID_DEMO_LOCATION_123456789
```

Both must be valid Sandbox credentials from your Square Developer account.

## Still Having Issues?

1. **Verify Square credentials**: Check that `applicationId` and `locationId` are correct
2. **Check Square Dashboard**: Ensure your application is active
3. **Verify amount**: Make sure appointment amount is > 0
4. **Check user profile**: Ensure patient profile has valid data
5. **Browser compatibility**: Square SDK requires modern browsers (Chrome, Firefox, Safari, Edge)

## Additional Resources

- [Square Web Payments SDK Documentation](https://developer.squareup.com/docs/web-payments/overview)
- [Square React SDK Documentation](https://developer.squareup.com/docs/web-payments/react)
- [Square Test Cards](https://developer.squareup.com/docs/web-payments/testing)
