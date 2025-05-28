# Unity Voice Learning Platform - Database Schema

## Database Tables

### Users
- **UserId** (PK) - Primary identifier for users
- **E-mail** - User's email address (unique)
- **FirstName** - User's first name
- **LastName** - User's last name
- **Password** - Encrypted password
- **PhoneNumber** - User's phone number
- **AgeRange** - Age range of the user
- **EnglishLevel** - User's proficiency level in English
- **ProfilePicture** - Path to profile picture
- **Score** - Total score accumulated by user
- **CompletedTasksCount** - Number of tasks completed
- **CreationDate** - Account creation date
- **LastLogin** - Last login timestamp
- **UserRole** - Role (e.g., 'student', 'admin')
- **UpdatedAt** - Last update timestamp

### Tasks
- **TaskId** (PK) - Primary identifier for tasks
- **UserId** (FK → Users) - User who owns this task
- **TopicName** (FK → Level) - Topic associated with task
- **Level** (FK → Level) - Difficulty level of task
- **TaskScore** - Score earned for completing task
- **TaskType** - Type of task (flashcard, quiz, post, conversation)
- **CompletionDate** - When task was completed (null if incomplete)
- **DurationTask** - Time spent on task (in seconds)
- **CreatedAt** - Task creation timestamp
- **UpdatedAt** - Last update timestamp

### Posts
- **PostID** (PK) - Primary identifier for posts
- **TaskId** (FK → Tasks) - Task associated with post
- **PostContent** - Text content of post
- **Picture** - Optional image path for post
- **CreatedAt** - Post creation timestamp
- **UpdatedAt** - Last update timestamp

### Comments
- **CommentID** (PK) - Primary identifier for comments
- **CommentContent** - Text content of comment
- **Feedback** - Feedback provided on comment
- **PostID** (FK → Posts) - Post associated with comment
- **CreatedAt** - Comment creation timestamp
- **UpdatedAt** - Last update timestamp

### Tests
- **TestID** (PK) - Primary identifier for tests
- **UserId** (FK → Users) - User who took the test
- **TestScore** - Score earned on test
- **TestType** - Type of test
- **CompletionDate** - When test was completed
- **DurationTest** - Time spent on test (in seconds)
- **CreatedAt** - Test creation timestamp
- **UpdatedAt** - Last update timestamp

### WordsInTask
- **TaskId** (FK → Tasks) - Task associated with words
- **WordId** (FK → Words) - Word associated with task
- Composite primary key (TaskId, WordId)

### Words
- **WordId** (PK) - Primary identifier for words
- **Word** - The English word
- **Translation** - Translation of the word
- **ExampleUsage** - Example sentence using the word
- **TopicName** - Topic associated with the word
- **CreatedAt** - Word creation timestamp
- **UpdatedAt** - Last update timestamp

### InteractiveSessions
- **SessionID** (PK) - Primary identifier for interactive sessions
- **SessionType** - Type of session
- **TaskId** (FK → Tasks) - Task associated with session
- **CreatedAt** - Session creation timestamp
- **UpdatedAt** - Last update timestamp

### Questions
- **QuestionID** (PK) - Primary identifier for questions
- **QuestionText** - Text of the question
- **AnswerText** - Correct answer text
- **Feedback** - Feedback for the answer
- **SessionID** (FK → InteractiveSessions) - Session associated with question
- **CreatedAt** - Question creation timestamp
- **UpdatedAt** - Last update timestamp

### Topics
- **TopicName** (PK) - Primary identifier for topics
- **TopicHe** - Topic name in Hebrew
- **Icon** - Icon representing the topic
- **CreatedAt** - Topic creation timestamp
- **UpdatedAt** - Last update timestamp

### Level
- **TopicName** (FK → Topics) - Topic associated with level
- **Level** (PK - part of composite key) - Level identifier
- **LevelScore** - Score required for level
- **CreatedAt** - Level creation timestamp
- **UpdatedAt** - Last update timestamp
- Composite primary key (TopicName, Level)

### UserInLevel
- **TopicName** (FK → Topics) - Topic for this user level record
- **Level** (FK → Level) - Level for this user level record
- **UserId** (FK → Users) - User for this level record
- **EarnedScore** - Score earned by user in this level
- **CompletedAt** - When user completed level
- **CreatedAt** - Record creation timestamp
- **UpdatedAt** - Last update timestamp
- Composite primary key (TopicName, Level, UserId)

## Relationships

1. **User to Tasks**: One-to-many (A user can have many tasks)
2. **User to Tests**: One-to-many (A user can take many tests)
3. **Task to WordsInTask**: One-to-many (A task can have many words)
4. **Word to WordsInTask**: One-to-many (A word can be in many tasks)
5. **Task to Posts**: One-to-many (A task can have many posts)
6. **Post to Comments**: One-to-many (A post can have many comments)
7. **Task to InteractiveSessions**: One-to-many (A task can have many sessions)
8. **InteractiveSessions to Questions**: One-to-many (A session can have many questions)
9. **Topic to Level**: One-to-many (A topic can have many levels)
10. **User to UserInLevel**: One-to-many (A user can be in many level records)
11. **Topic to UserInLevel**: One-to-many (A topic can have many user level records)
12. **Level to UserInLevel**: One-to-many (A level can have many user level records)

## Database Indexes

Recommended indexes for optimal performance:

1. Users(Email) - For quick user lookup by email
2. Tasks(UserId, TopicName, Level) - For fetching user's tasks by topic and level
3. Words(TopicName) - For fetching words by topic
4. WordsInTask(TaskId) - For fetching words for a specific task
5. WordsInTask(WordId) - For fetching tasks using a specific word
6. Posts(TaskId) - For fetching posts related to a task
7. Comments(PostID) - For fetching comments on a post
8. UserInLevel(UserId, TopicName) - For fetching user progress in a topic

## MySQL Schema Creation

```sql
-- Create database
CREATE DATABASE IF NOT EXISTS unity_voice_learning;
USE unity_voice_learning;

-- Users table
CREATE TABLE Users (
    UserId CHAR(36) PRIMARY KEY,
    Email VARCHAR(255) NOT NULL UNIQUE,
    FirstName VARCHAR(100),
    LastName VARCHAR(100),
    Password VARCHAR(255) NOT NULL,
    PhoneNumber VARCHAR(20),
    AgeRange VARCHAR(20),
    EnglishLevel VARCHAR(20),
    ProfilePicture VARCHAR(255),
    Score INT DEFAULT 0,
    CompletedTasksCount INT DEFAULT 0,
    CreationDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    LastLogin DATETIME,
    UserRole VARCHAR(20) DEFAULT 'student',
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (Email)
);

-- Topics table
CREATE TABLE Topics (
    TopicName VARCHAR(100) PRIMARY KEY,
    TopicHe VARCHAR(100) NOT NULL,
    Icon VARCHAR(50),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Level table
CREATE TABLE Level (
    TopicName VARCHAR(100),
    Level VARCHAR(20),
    LevelScore INT DEFAULT 0,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (TopicName, Level),
    FOREIGN KEY (TopicName) REFERENCES Topics(TopicName) ON DELETE CASCADE
);

-- Tasks table
CREATE TABLE Tasks (
    TaskId CHAR(36) PRIMARY KEY,
    UserId CHAR(36) NOT NULL,
    TopicName VARCHAR(100) NOT NULL,
    Level VARCHAR(20) NOT NULL,
    TaskScore INT DEFAULT 0,
    TaskType VARCHAR(20) NOT NULL,
    CompletionDate DATETIME,
    DurationTask INT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (UserId) REFERENCES Users(UserId),
    FOREIGN KEY (TopicName, Level) REFERENCES Level(TopicName, Level),
    INDEX idx_user_topic_level (UserId, TopicName, Level)
);

-- Words table
CREATE TABLE Words (
    WordId CHAR(36) PRIMARY KEY,
    Word VARCHAR(100) NOT NULL,
    Translation VARCHAR(100) NOT NULL,
    ExampleUsage TEXT,
    TopicName VARCHAR(100) NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_topic (TopicName)
);

-- WordsInTask table
CREATE TABLE WordsInTask (
    TaskId CHAR(36) NOT NULL,
    WordId CHAR(36) NOT NULL,
    PRIMARY KEY (TaskId, WordId),
    FOREIGN KEY (TaskId) REFERENCES Tasks(TaskId) ON DELETE CASCADE,
    FOREIGN KEY (WordId) REFERENCES Words(WordId),
    INDEX idx_task (TaskId),
    INDEX idx_word (WordId)
);

-- Posts table
CREATE TABLE Posts (
    PostID CHAR(36) PRIMARY KEY,
    TaskId CHAR(36) NOT NULL,
    PostContent TEXT NOT NULL,
    Picture VARCHAR(255),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (TaskId) REFERENCES Tasks(TaskId) ON DELETE CASCADE,
    INDEX idx_task (TaskId)
);

-- Comments table
CREATE TABLE Comments (
    CommentID CHAR(36) PRIMARY KEY,
    CommentContent TEXT NOT NULL,
    Feedback TEXT,
    PostID CHAR(36) NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (PostID) REFERENCES Posts(PostID) ON DELETE CASCADE,
    INDEX idx_post (PostID)
);

-- Tests table
CREATE TABLE Tests (
    TestID CHAR(36) PRIMARY KEY,
    UserId CHAR(36) NOT NULL,
    TestScore INT DEFAULT 0,
    TestType VARCHAR(20) NOT NULL,
    CompletionDate DATETIME,
    DurationTest INT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (UserId) REFERENCES Users(UserId),
    INDEX idx_user (UserId)
);

-- InteractiveSessions table
CREATE TABLE InteractiveSessions (
    SessionID CHAR(36) PRIMARY KEY,
    SessionType VARCHAR(20) NOT NULL,
    TaskId CHAR(36) NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (TaskId) REFERENCES Tasks(TaskId) ON DELETE CASCADE,
    INDEX idx_task (TaskId)
);

-- Questions table
CREATE TABLE Questions (
    QuestionID CHAR(36) PRIMARY KEY,
    QuestionText TEXT NOT NULL,
    AnswerText TEXT NOT NULL,
    Feedback TEXT,
    SessionID CHAR(36) NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (SessionID) REFERENCES InteractiveSessions(SessionID) ON DELETE CASCADE,
    INDEX idx_session (SessionID)
);

-- UserInLevel table
CREATE TABLE UserInLevel (
    TopicName VARCHAR(100) NOT NULL,
    Level VARCHAR(20) NOT NULL,
    UserId CHAR(36) NOT NULL,
    EarnedScore INT DEFAULT 0,
    CompletedAt DATETIME,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (TopicName, Level, UserId),
    FOREIGN KEY (TopicName, Level) REFERENCES Level(TopicName, Level),
    FOREIGN KEY (UserId) REFERENCES Users(UserId),
    INDEX idx_user_topic (UserId, TopicName)
);
``` 