import app from './app.js';
import { connectDatabase } from './config/database.js';
import { env, logger } from './config/env.js';

const port = env.PORT;

const startServer = async () => {
  try {
    await connectDatabase();

    app.listen(port, () => {
      logger.info(`Server is listening on port ${port}`);
    });
  } catch (error) {
    logger.error({ err: error }, 'Server failed to start');
    process.exit(1);
  }
};

startServer();
