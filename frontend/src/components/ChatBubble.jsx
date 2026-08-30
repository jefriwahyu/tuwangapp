function ChatBubble({ sender, text }) {
    return (
        <div>
            <strong>{sender}:</strong> {text}
        </div>
    )
}

export default ChatBubble;