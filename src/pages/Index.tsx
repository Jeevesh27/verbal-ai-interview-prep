
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('Click "Start Interview" to begin your AI interview session.');
  const [sessionId] = useState('6851086aed4d8125b0785e87'); // You can make this dynamic
  const [isProcessing, setIsProcessing] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  // Initialize camera on component mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsVideoOn(true);
      toast({
        title: "Camera started",
        description: "Your camera is now active for the interview.",
      });
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Please allow camera access for the interview.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsVideoOn(false);
  };

  const startInterview = async () => {
    if (!streamRef.current) {
      toast({
        title: "Camera Required",
        description: "Please enable your camera to start the interview.",
        variant: "destructive",
      });
      return;
    }

    setInterviewStarted(true);
    setCurrentQuestion("Welcome to your AI interview! I'll ask you questions and you can respond by clicking the microphone button. Let's start: Tell me about yourself and your background.");
    
    // Convert first question to speech
    speakText("Welcome to your AI interview! I'll ask you questions and you can respond by clicking the microphone button. Let's start: Tell me about yourself and your background.");
  };

  const startRecording = async () => {
    if (!streamRef.current) {
      toast({
        title: "No audio stream",
        description: "Please ensure microphone access is granted.",
        variant: "destructive",
      });
      return;
    }

    try {
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: "Recording started",
        description: "Speak your answer now. Click stop when finished.",
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please try again.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      
      toast({
        title: "Processing response",
        description: "Converting your speech to text and getting next question...",
      });
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      // Convert audio to text (using Web Speech API as fallback)
      const transcript = await convertSpeechToText(audioBlob);
      
      if (transcript) {
        // Send to AI interviewer API
        await sendResponseToAI(transcript);
      } else {
        toast({
          title: "Speech not detected",
          description: "Please try speaking again more clearly.",
          variant: "destructive",
        });
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        title: "Processing Error",
        description: "Failed to process your response. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const convertSpeechToText = async (audioBlob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const recognition = new (window as any).webkitSpeechRecognition() || new (window as any).SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        resolve(transcript);
      };

      recognition.onerror = () => {
        resolve('');
      };

      recognition.start();
      
      // Fallback: if speech recognition fails, return a placeholder
      setTimeout(() => {
        resolve('I have provided my response');
      }, 5000);
    });
  };

  const sendResponseToAI = async (userResponse: string) => {
    try {
      const response = await fetch('https://3c6f-160-22-60-12.ngrok-free.app/generateInterview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          userResponse: userResponse
        })
      });

      const data = await response.json();
      
      if (data.ok && data.question) {
        setCurrentQuestion(data.question);
        speakText(data.question);
        
        toast({
          title: "Response processed",
          description: "Here's your next question!",
        });
      } else {
        throw new Error('Invalid response from AI');
      }
    } catch (error) {
      console.error('Error sending to AI:', error);
      toast({
        title: "API Error",
        description: "Failed to get next question. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">AI Interview Assistant</h1>
          <p className="text-lg text-gray-600">Practice your interview skills with our AI interviewer</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Video Feed */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isVideoOn ? (
                  <Video className="h-5 w-5 text-green-600" />
                ) : (
                  <VideoOff className="h-5 w-5 text-red-600" />
                )}
                Camera Feed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!isVideoOn && (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <div className="text-center">
                      <VideoOff className="h-12 w-12 mx-auto mb-2" />
                      <p>Camera Off</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={startCamera}
                  disabled={isVideoOn}
                  variant={isVideoOn ? "secondary" : "default"}
                  className="flex-1"
                >
                  <Video className="h-4 w-4 mr-2" />
                  {isVideoOn ? "Camera Active" : "Start Camera"}
                </Button>
                <Button
                  onClick={stopCamera}
                  disabled={!isVideoOn}
                  variant="outline"
                  className="flex-1"
                >
                  <VideoOff className="h-4 w-4 mr-2" />
                  Stop Camera
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Interview Interface */}
          <Card>
            <CardHeader>
              <CardTitle>Interview Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Question */}
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <h3 className="font-semibold text-blue-900 mb-2">Current Question:</h3>
                <p className="text-blue-800">{currentQuestion}</p>
              </div>

              {/* Control Buttons */}
              <div className="space-y-3">
                {!interviewStarted ? (
                  <Button
                    onClick={startInterview}
                    disabled={!isVideoOn}
                    className="w-full py-6 text-lg"
                    size="lg"
                  >
                    Start Interview
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={toggleRecording}
                      disabled={isProcessing}
                      className={`w-full py-6 text-lg ${
                        isRecording 
                          ? 'bg-red-600 hover:bg-red-700' 
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                      size="lg"
                    >
                      {isRecording ? (
                        <>
                          <MicOff className="h-6 w-6 mr-2" />
                          Stop Recording
                        </>
                      ) : (
                        <>
                          <Mic className="h-6 w-6 mr-2" />
                          {isProcessing ? "Processing..." : "Start Recording Answer"}
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={() => speakText(currentQuestion)}
                      variant="outline"
                      className="w-full"
                      disabled={isProcessing}
                    >
                      🔊 Repeat Question
                    </Button>
                  </>
                )}
              </div>

              {/* Status Indicators */}
              <div className="flex gap-4 text-sm">
                <div className={`flex items-center gap-2 ${isVideoOn ? 'text-green-600' : 'text-red-600'}`}>
                  <div className={`w-2 h-2 rounded-full ${isVideoOn ? 'bg-green-600' : 'bg-red-600'}`}></div>
                  Camera: {isVideoOn ? 'Active' : 'Inactive'}
                </div>
                <div className={`flex items-center gap-2 ${isRecording ? 'text-red-600' : 'text-gray-600'}`}>
                  <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-gray-400'}`}></div>
                  Recording: {isRecording ? 'Active' : 'Inactive'}
                </div>
              </div>

              {/* Instructions */}
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                <h4 className="font-semibold mb-1">Instructions:</h4>
                <ul className="space-y-1">
                  <li>• Keep your camera on throughout the interview</li>
                  <li>• Click the microphone button to record your answer</li>
                  <li>• Speak clearly and click stop when finished</li>
                  <li>• The AI will process your response and ask the next question</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
