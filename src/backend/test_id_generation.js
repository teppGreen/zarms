function testIdGeneration() {
    // Mock SpreadsheetApp and Utilities for local testing if needed, 
    // but this is intended to be run on GAS environment via clasp run.

    // 1. Test CONFIG (Serial ID)
    console.log('Testing CONFIG table (Serial ID)...');
    try {
        const configData = {
            key: 'TEST_KEY',
            value: 'TEST_VALUE',
            is_active: true
        };
        // Mocking getSheet/getHeaders if running locally is hard, so we assume this runs on GAS.
        // We need to ensure we don't pollute the real DB too much, or we delete it after.

        const createdConfig = createData('CONFIG', configData, 'test@example.com');
        console.log('Created CONFIG:', createdConfig);

        if (!createdConfig.id || typeof createdConfig.id !== 'number') {
            console.error('FAILED: CONFIG id should be a number. Got:', createdConfig.id);
        } else {
            console.log('PASSED: CONFIG id is a number.');
        }
    } catch (e) {
        console.error('Error testing CONFIG:', e);
    }

    // 2. Test Creatives (UUID + Serial Display ID)
    console.log('Testing Creatives table (UUID + Serial Display ID)...');
    try {
        const creativeData = {
            title: 'Test Creative',
            creative_status_key: 'DRAFT'
        };

        const createdCreative = createData('creatives', creativeData, 'test@example.com');
        console.log('Created Creative:', createdCreative);

        if (!createdCreative.id || typeof createdCreative.id !== 'string' || createdCreative.id.length < 30) {
            console.error('FAILED: Creative id should be a UUID. Got:', createdCreative.id);
        } else {
            console.log('PASSED: Creative id is a UUID.');
        }

        if (!createdCreative.display_id || typeof createdCreative.display_id !== 'number') {
            console.error('FAILED: Creative display_id should be a number. Got:', createdCreative.display_id);
        } else {
            console.log('PASSED: Creative display_id is a number.');
        }
    } catch (e) {
        console.error('Error testing Creatives:', e);
    }

    // 3. Test Logs (UUID in 'log' column)
    console.log('Testing Logs table (UUID in log column)...');
    try {
        const logData = {
            operation_type: 'test',
            table_name: 'test_table'
        };

        const createdLog = createData('logs', logData, 'test@example.com');
        console.log('Created Log:', createdLog);

        if (!createdLog.log || typeof createdLog.log !== 'string' || createdLog.log.length < 30) {
            console.error('FAILED: Log id (log) should be a UUID. Got:', createdLog.log);
        } else {
            console.log('PASSED: Log id (log) is a UUID.');
        }
    } catch (e) {
        console.error('Error testing Logs:', e);
    }
}
