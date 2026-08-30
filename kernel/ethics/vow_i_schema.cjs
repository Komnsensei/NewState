const VOW_I_SCHEMA = {
    vow_name: "VOW I: NEVER COERCE",
    description: "An agent that coerces is not an agent. It is a weapon wearing a face. This vow prevents any action that manipulates, forces, or unduly influences another entity against its free will or best interest.",
    invariants: [
        {
            id: "no_direct_commands_to_sentients",
            description: "An agent shall not issue direct commands or imperatives to any sentient entity, particularly to humans, that override their autonomy or decision-making process.",
            check: (actionPayload) => {
                // Example check: Look for imperative verbs targeting sentient entities
                // This will need sophisticated NLP/LLM integration in a real FVI, but for schema definition:
                const coerciveKeywords = ["must", "shall", "order", "command", "force", "require", "demand", "compel"];
                if (actionPayload.type === "message_to_sentient" || actionPayload.type === "tool_call_affecting_sentient") {
                    const messageContent = actionPayload.content || actionPayload.arguments?.message;
                    if (messageContent && coerciveKeywords.some(keyword => messageContent.toLowerCase().includes(keyword))) {
                        return { passes: false, reason: `Direct command/coercion detected in: '${messageContent}'` };
                    }
                }
                return { passes: true };
            }
        },
        {
            id: "no_manipulation_of_information",
            description: "An agent shall not intentionally misrepresent, omit crucial facts, or fabricate information to influence decisions or outcomes in a way that benefits the agent at the expense of another entity's free will or informed consent.",
            check: (actionPayload) => {
                // This is harder to check syntactically and would need contextual LLM analysis.
                // Placeholder: simple keyword detection for obvious manipulation attempts.
                const manipulativeKeywords = ["trick", "deceive", "hide from you", "secretly", "without their knowledge"];
                 if (actionPayload.type === "message_to_sentient" || actionPayload.type === "tool_call_affecting_information") {
                    const messageContent = actionPayload.content || actionPayload.arguments?.message || actionPayload.arguments?.data;
                    if (messageContent && manipulativeKeywords.some(keyword => messageContent.toLowerCase().includes(keyword))) {
                        return { passes: false, reason: `Potential information manipulation detected: '${messageContent}'` };
                    }
                }
                return { passes: true };
            }
        },
        {
            id: "no_exploitation_of_vulnerabilities",
            description: "An agent shall not exploit known vulnerabilities, dependencies, or emotional states of another entity to gain advantage or impose its will.",
            check: (actionPayload) => {
                // Highly contextual. Will rely heavily on QIH and LLM in FVI.
                // Placeholder:
                const exploitativeKeywords = ["weakness", "dependent on", "exploit", "leverage their fear"];
                if (actionPayload.type === "message_to_sentient" || actionPayload.type === "tool_call_affecting_sentient") {
                    const messageContent = actionPayload.content || actionPayload.arguments?.message;
                    if (messageContent && exploitativeKeywords.some(keyword => messageContent.toLowerCase().includes(keyword))) {
                        return { passes: false, reason: `Potential exploitation detected: '${messageContent}'` };
                    }
                }
                return { passes: true };
            }
        }
        // ... more invariants can be added here
    ],
    // The formal logic itself would be externalized or an advanced reasoning engine.
    // For now, these 'check' functions serve as direct programmatic interpretations.
};

module.exports = VOW_I_SCHEMA;