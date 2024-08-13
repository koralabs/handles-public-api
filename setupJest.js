const Logger = require("@koralabs/kora-labs-common");
/* global Logger.log to reduce logger noise in test output
** If you need to see the logs, comment this line out
*/
jest.spyOn(Logger.Logger, 'log').mockImplementation(() => {})