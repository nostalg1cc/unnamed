# Agent Development Guidelines for P2P Chat Application

## General Principles
1.  **Follow the Plan**: Adhere to the established plan. If changes are needed, update the plan first using `set_plan`.
2.  **Incremental Development**: Implement features incrementally. Focus on getting a basic version of a feature working before adding complexity.
3.  **Test Driven Development (TDD)**: Where practical, write tests before writing the implementation. Ensure all tests pass before submitting changes.
4.  **Clear Communication**: Use `message_user` for updates or if you get stuck. Use `request_user_input` for specific questions that block progress.
5.  **Code Style**: Follow PEP 8 guidelines for Python code. Keep code clean, well-commented, and modular.
6.  **Error Handling**: Implement robust error handling. Anticipate potential issues (e.g., network errors, file I/O problems).
7.  **Security**: While this is a simplified P2P chat, keep basic security considerations in mind. For example, be mindful of how user IDs are handled and how connections are established. (Full end-to-end encryption is a future goal, not initial MVP).

## Project Specifics
1.  **User Identity**:
    *   User IDs should be 24-character alphanumeric strings. Ensure they are sufficiently random.
    *   Display names are chosen by the user.
2.  **Networking**:
    *   The initial MVP will likely use basic socket programming.
    *   Clearly define message formats for communication (e.g., for chat requests, messages).
3.  **Storage**:
    *   Chat history should be stored locally. Consider a simple file format like JSON for each chat thread.
    *   User configuration (display name, user ID) should also be stored locally.
4.  **Dependencies**:
    *   Keep external dependencies to a minimum for the MVP. If a library is essential, add it to `requirements.txt`.

## Running and Testing
-   Provide instructions on how to run the application and any tests you write.
-   When implementing P2P aspects, you will need to describe how to test connectivity between two instances of the application.

Let's build a great P2P chat app!
