import {useEffect, useRef} from "react";

interface Message {
  content: string;
  // Add other properties as needed
}

export function useScrollToView(messages: Message[]) {
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({behavior: 'smooth'});
    }
  }, [messages]);

  return messageEndRef;
}
