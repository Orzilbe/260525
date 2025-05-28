import express from 'express';
import cors from 'cors';
import taskRoutes from './routes/taskRoutes';
import userWordsRoutes from './routes/userWordsRoutes';

const app = express();

app.use(cors());
app.use(express.json());

// Register routes
app.use('/api/tasks', taskRoutes);
app.use('/api/user-words', userWordsRoutes);

export default app; 