import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from "uuid";
import { uploadFile, queryBackend, summarizeText, generateQuiz } from "./services/api";
import { whisperService } from "./services/whisperService";
import { 
  Sparkles, Moon, Sun, Send, Menu, 
  MessageSquare, History, Book, User,
  Upload, Mic, FileText, Image as ImageIcon,
  Link2, Wand2, GraduationCap, Square, X
} from 'lucide-react';

interface Message {
  role: string;
  content: string;
  type?: 'message' | 'summary' | 'quiz';
}

interface ChatHistoryItem {
  id: string;
  title: string;
  date: string;
  messages: Message[];
}

const LumineAI = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [sessionId] = useState(() => sessionStorage.getItem("session_id") || uuidv4());
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [whisperReady, setWhisperReady] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  // Chat history
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>(() => {
    const saved = localStorage.getItem('lumine_chat_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [historySearch, setHistorySearch] = useState('');

  // Set session ID on mount and initialize Whisper
  useEffect(() => {
    sessionStorage.setItem("session_id", sessionId);
    
    const initializeWhisper = async () => {
      try {
        await whisperService.initialize();
        setWhisperReady(true);
      } catch (error) {
        console.error('Failed to initialize Whisper:', error);
        setWhisperReady(false);
      }
    };

    initializeWhisper();
  }, [sessionId]);

  // Save chat history when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (lastUserMessage) {
        const historyItem: ChatHistoryItem = {
          id: Date.now().toString(),
          title: lastUserMessage.content.substring(0, 30) + (lastUserMessage.content.length > 30 ? '...' : ''),
          date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
          messages: [...messages]
        };

        setChatHistory(prev => {
          const updated = [historyItem, ...prev.filter(item => item.id !== historyItem.id)].slice(0, 20); // Keep last 20 chats
          localStorage.setItem('lumine_chat_history', JSON.stringify(updated));
          return updated;
        });
      }
    }
  }, [messages]);

  const fileInputRefDocs = useRef<HTMLInputElement>(null);
  const fileInputRefImages = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Tools list
  const tools = [
    { icon: Wand2, name: 'Summarizer', desc: 'Summarize conversation', action: 'summarize' },
    { icon: GraduationCap, name: 'Quiz', desc: 'Generate quiz questions', action: 'quiz' },
  ];

  const handleSend = async () => {
    if (!searchQuery.trim()) return;

    const userMessage = searchQuery;
    setSearchQuery("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);

    try {
      const result = await queryBackend(userMessage, sessionId);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: result.answer || "Response from AI",
        type: 'message'
      }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Error: Backend not responding. Make sure server is running on http://localhost:8000"
      }]);
    }
  };

  // Tools functions
  const handleSummarize = async () => {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content;
    if (!lastUserMessage) {
      alert('No conversation to summarize. Please chat first!');
      return;
    }

    try {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "📝 Generating summary...",
        type: 'summary'
      }]);

      const result = await summarizeText(lastUserMessage, sessionId);
      setMessages(prev => [...prev.slice(0, -1), { 
        role: "assistant", 
        content: `📋 SUMMARY:\n\n${result.summary || "Here's a summary of our conversation."}`,
        type: 'summary'
      }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev.slice(0, -1), { 
        role: "assistant", 
        content: "❌ Error generating summary",
        type: 'summary'
      }]);
    }
  };

  const handleGenerateQuiz = async () => {
    try {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "🎯 Generating quiz questions...",
        type: 'quiz'
      }]);

      const result = await generateQuiz(sessionId);
      setMessages(prev => [...prev.slice(0, -1), { 
        role: "assistant", 
        content: `🧠 QUIZ:\n\n${result.quiz || "No documents available for quiz generation. Please upload documents first."}`,
        type: 'quiz'
      }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev.slice(0, -1), { 
        role: "assistant", 
        content: "🧠 QUIZ (Sample):\n\n1. What is machine learning?\n   A) Computers learning from data\n   B) Manual programming\n   C) Hardware optimization\n   D) Network configuration\n   Correct: A",
        type: 'quiz'
      }]);
    }
  };

  const handleToolAction = (action: string) => {
    setShowToolsMenu(false);
    
    switch (action) {
      case 'summarize':
        handleSummarize();
        break;
      case 'quiz':
        handleGenerateQuiz();
        break;
      default:
        break;
    }
  };

  // File upload with progress
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const resp = await uploadFile(file, sessionId);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        alert(`✅ Uploaded ${file.name} successfully!`);
      }, 500);

    } catch (err) {
      console.error(err);
      setIsUploading(false);
      setUploadProgress(0);
      alert("❌ Upload failed. Make sure backend is running.");
    }
  };

  const handleDocumentUploadClick = () => {
    fileInputRefDocs.current?.click();
    setShowUploadMenu(false);
  };

  const handleImageUploadClick = () => {
    fileInputRefImages.current?.click();
    setShowUploadMenu(false);
  };

  const handleDocsSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFileUpload(file);
    e.target.value = "";
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFileUpload(file);
    e.target.value = "";
  };

  // Voice input functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error accessing microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    if (!whisperReady) {
      alert('Speech recognition is not ready yet. Please try again in a moment.');
      return;
    }

    setIsTranscribing(true);
    try {
      const transcribedText = await whisperService.transcribe(audioBlob);
      if (transcribedText.trim()) {
        setSearchQuery(prev => prev + (prev ? ' ' : '') + transcribedText);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      alert('Error transcribing audio. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleVoiceInput = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // History functions
  const loadChatHistory = (historyItem: ChatHistoryItem) => {
    setMessages(historyItem.messages);
    setShowHistory(false);
  };

  const clearChatHistory = () => {
    setMessages([]);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem('lumine_chat_history', JSON.stringify(updated));
      return updated;
    });
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowUploadMenu(false);
      setShowToolsMenu(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  // Simple styling variables
  const isDark = theme === 'dark';
  const bgMain = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const bgSidebar = isDark ? 'bg-gray-800' : 'bg-white';
  const bgContent = isDark ? 'bg-gray-700' : 'bg-white';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const hoverBg = isDark ? 'hover:bg-gray-700' : 'hover:bg-amber-50';

  const filteredHistory = chatHistory.filter(chat =>
    chat.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className={`min-h-screen ${bgMain} ${textColor} flex`}>
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRefDocs}
        onChange={handleDocsSelected}
        accept=".pdf,.doc,.docx,.txt"
        style={{ display: "none" }}
      />
      <input
        type="file"
        ref={fileInputRefImages}
        onChange={handleImageSelected}
        accept="image/*"
        style={{ display: "none" }}
      />

      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} ${bgSidebar} border-r ${borderColor} p-4 flex flex-col transition-all duration-300`}>
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-8">
            <Sparkles className="w-8 h-8 text-amber-400" />
            {!sidebarCollapsed && <h1 className="text-xl font-bold">Lumine AI</h1>}
          </div>
          
          <nav className="space-y-2">
            <button 
              onClick={clearChatHistory}
              className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-amber-50 dark:hover:bg-gray-700"
            >
              <MessageSquare className="w-5 h-5 text-amber-400" />
              {!sidebarCollapsed && <span>New Chat</span>}
            </button>
            
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-amber-50 dark:hover:bg-gray-700 ${showHistory ? 'bg-amber-400 text-black' : ''}`}
            >
              <History className="w-5 h-5 text-gray-400" />
              {!sidebarCollapsed && <span>History</span>}
            </button>
            
            <button className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-amber-50 dark:hover:bg-gray-700">
              <Book className="w-5 h-5 text-gray-400" />
              {!sidebarCollapsed && <span>Library</span>}
            </button>
          </nav>

          {/* History Panel */}
          {showHistory && !sidebarCollapsed && (
            <div className={`mt-4 ${bgContent} border ${borderColor} rounded-xl overflow-hidden`}>
              <div className="p-3 space-y-3">
                {/* Search Bar */}
                <div className={`flex items-center space-x-2 px-3 py-2 ${isDark ? 'bg-gray-600' : 'bg-gray-100'} rounded-lg`}>
                  <History className="w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search history..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className={`flex-1 bg-transparent outline-none ${textColor} text-sm`}
                  />
                </div>

                {/* Chat History List */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredHistory.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => loadChatHistory(chat)}
                      className={`w-full p-2 rounded-lg ${hoverBg} text-left transition-all group text-sm relative`}
                    >
                      <div className="font-medium group-hover:text-amber-400 transition-colors truncate pr-6">
                        {chat.title}
                      </div>
                      <div className={`text-xs ${textColor} opacity-60`}>{chat.date}</div>
                      <button
                        onClick={(e) => deleteHistoryItem(chat.id, e)}
                        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </button>
                  ))}
                  {filteredHistory.length === 0 && (
                    <div className="text-center text-sm text-gray-500 py-4">
                      No chat history
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile at bottom */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <button className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-amber-50 dark:hover:bg-gray-700">
            <User className="w-5 h-5 text-gray-400" />
            {!sidebarCollapsed && <span>Profile</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className={`${bgSidebar} border-b ${borderColor} p-4 flex justify-between items-center`}>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-gray-700"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Sparkles className="w-6 h-6 text-amber-400" />
          </div>

          <div className="flex items-center space-x-4">
            {/* Upload Progress */}
            {isUploading && (
              <div className="flex items-center space-x-2">
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-400 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-500">{uploadProgress}%</span>
              </div>
            )}

            {/* Whisper Status */}
            <div className={`text-xs px-2 py-1 rounded-full ${
              whisperReady 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            }`}>
              {whisperReady ? '🎤 Voice Ready' : '🔊 Loading Voice...'}
            </div>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-gray-700"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 p-8 ${bgMain} overflow-y-auto`}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="w-16 h-16 text-amber-400 mb-4" />
              <h2 className="text-3xl font-bold mb-2">Welcome to Lumine AI</h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Ask. Explore. Build.
              </p>
              <p className="text-gray-500 dark:text-gray-500 text-sm mt-4">
                💡 Upload documents, use voice input, or start chatting!
              </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg max-w-[80%] whitespace-pre-line ${
                    message.role === 'user' 
                      ? 'bg-amber-400 text-black ml-auto' 
                      : message.type === 'summary'
                      ? 'bg-blue-100 text-blue-900 border border-blue-300 mr-auto'
                      : message.type === 'quiz'
                      ? 'bg-green-100 text-green-900 border border-green-300 mr-auto'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 mr-auto'
                  }`}
                >
                  {message.content}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className={`p-6 ${bgSidebar} border-t ${borderColor}`}>
          <div className="max-w-4xl mx-auto flex items-center space-x-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            {/* Tools Button */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowToolsMenu(!showToolsMenu);
                }}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:border-amber-400"
              >
                <Wand2 className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium">Tools</span>
              </button>

              {showToolsMenu && (
                <div 
                  className={`absolute bottom-full mb-2 left-0 w-64 ${bgContent} border ${borderColor} rounded-lg shadow-xl p-3 z-50`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-2">
                    {tools.map((tool) => (
                      <button
                        key={tool.name}
                        onClick={() => handleToolAction(tool.action)}
                        className={`w-full flex items-start space-x-3 p-3 rounded-lg ${hoverBg} text-left`}
                      >
                        <tool.icon className="w-5 h-5 text-amber-400 mt-0.5" />
                        <div>
                          <div className="font-medium">{tool.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{tool.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Upload Button */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUploadMenu(!showUploadMenu);
                }}
                className={`p-2 rounded-lg ${isUploading ? 'text-amber-400' : 'text-gray-500 hover:text-amber-400'}`}
                disabled={isUploading}
              >
                <Upload className="w-5 h-5" />
              </button>

              {showUploadMenu && (
                <div 
                  className={`absolute bottom-full mb-2 left-0 w-48 ${bgContent} border ${borderColor} rounded-lg shadow-xl p-2 z-50`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={handleDocumentUploadClick}
                    className={`w-full flex items-center space-x-3 p-3 rounded-lg ${hoverBg}`}
                  >
                    <FileText className="w-5 h-5 text-amber-400" />
                    <span>Documents</span>
                  </button>
                  <button
                    onClick={handleImageUploadClick}
                    className={`w-full flex items-center space-x-3 p-3 rounded-lg ${hoverBg}`}
                  >
                    <ImageIcon className="w-5 h-5 text-amber-400" />
                    <span>Images</span>
                  </button>
                </div>
              )}
            </div>

            {/* Voice Input */}
            <button 
              onClick={handleVoiceInput}
              disabled={!whisperReady || isTranscribing || isUploading}
              className={`p-2 rounded-lg transition-all ${
                isRecording 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : isTranscribing
                  ? 'bg-amber-400 text-black'
                  : whisperReady && !isUploading
                  ? 'text-gray-500 hover:text-amber-400 hover:scale-110'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              title={whisperReady ? "Voice input" : "Voice input loading..."}
            >
              {isTranscribing ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : isRecording ? (
                <Square className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            {/* Text Input */}
            <input
              type="text"
              placeholder="Type your message or use voice input..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-transparent outline-none text-sm"
              disabled={isUploading}
            />

            {/* Send Button */}
            <button 
              onClick={handleSend}
              disabled={!searchQuery.trim() || isUploading}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                searchQuery.trim() && !isUploading
                  ? 'bg-amber-400 text-black hover:bg-amber-500 hover:scale-105' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
            {isRecording && "🎤 Recording... Click again to stop • "}
            {isTranscribing && "⏳ Transcribing... • "}
            {isUploading && "📤 Uploading... • "}
            Lumine AI can make mistakes. Consider checking important information.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LumineAI;