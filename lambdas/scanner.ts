type ScannerApp = typeof import('./scanner.app');

const isSelfHostedScannerRuntime = () => {
    return process.env.KORA_SCANNER_DEFER_IMPORTS?.toLowerCase() === 'true';
};

const isFunctionUrlEvent = (event: any): boolean => Boolean(event?.requestContext?.http);

const logScannerBootstrapFailure = (error: unknown) => {
    const message = error instanceof Error ? error.message : `${error}`;
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(JSON.stringify({
        category: 'ERROR',
        event: 'scannerLambda.bootstrapFailure',
        message: `Scanner bootstrap failed: ${message}`,
        stack
    }));
};

const buildScannerBootstrapFailureResponse = (event: any) => {
    if (!isFunctionUrlEvent(event)) return undefined;
    return {
        isBase64Encoded: false,
        statusCode: 500,
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({ message: 'Scanner bootstrap failed' })
    };
};

const runScannerEntrypoint = async <T>(event: any, run: () => Promise<T>) => {
    try {
        return await run();
    } catch (error) {
        if (!isSelfHostedScannerRuntime()) throw error;
        logScannerBootstrapFailure(error);
        return buildScannerBootstrapFailureResponse(event);
    }
};

const validateScannerEnvironment = async () => {
    const { validatePlaintextStartup } = await import('../utils/startupEnvironment');
    return validatePlaintextStartup();
};

export const lambdaHandler = async (event: any, context: any) => runScannerEntrypoint(event, async () => {
    await validateScannerEnvironment();
    const { lambdaHandler: scannerLambdaHandler } = await import('./scanner.app');
    return scannerLambdaHandler(event, context);
});

export const Internal = {
    checkRollback: async (...args: Parameters<ScannerApp['Internal']['checkRollback']>) => {
        await validateScannerEnvironment();
        const { Internal: scannerInternal } = await import('./scanner.app');
        return scannerInternal.checkRollback(...args);
    },
    processRollback: async (...args: Parameters<ScannerApp['Internal']['processRollback']>) => {
        await validateScannerEnvironment();
        const { Internal: scannerInternal } = await import('./scanner.app');
        return scannerInternal.processRollback(...args);
    },
    processReindex: async (...args: Parameters<ScannerApp['Internal']['processReindex']>) => {
        await validateScannerEnvironment();
        const { Internal: scannerInternal } = await import('./scanner.app');
        return scannerInternal.processReindex(...args);
    },
    scan: async (...args: Parameters<ScannerApp['Internal']['scan']>) => {
        await validateScannerEnvironment();
        const { Internal: scannerInternal } = await import('./scanner.app');
        return scannerInternal.scan(...args);
    }
};
