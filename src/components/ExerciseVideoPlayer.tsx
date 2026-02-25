import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';

// Dynamically import expo-av to handle cases where it's not installed
let Video: any;
let ResizeMode: any;
let AVPlaybackStatus: any;

try {
  const expoAv = require('expo-av');
  Video = expoAv.Video;
  ResizeMode = expoAv.ResizeMode;
  AVPlaybackStatus = expoAv.AVPlaybackStatus;
} catch (error) {
  // expo-av not installed - will handle gracefully
  console.warn('expo-av not available. Install with: npx expo install expo-av');
}

interface ExerciseVideoPlayerProps {
  visible: boolean;
  exerciseName: string;
  videoUrl?: string;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ExerciseVideoPlayer({
  visible,
  exerciseName,
  videoUrl,
  onClose,
}: ExerciseVideoPlayerProps) {
  const videoRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle YouTube/Vimeo URLs - open in browser
  const isYouTubeUrl = (url: string) => {
    return url.includes('youtube.com') || url.includes('youtu.be');
  };

  const isVimeoUrl = (url: string) => {
    return url.includes('vimeo.com');
  };

  const handleOpenExternalVideo = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open video link');
    });
  };

  const handlePlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setIsLoading(false);
      setIsPlaying(status.isPlaying);
      if (status.error) {
        setError('Error playing video');
        console.error('Video playback error:', status.error);
      }
    } else if (status.error) {
      setIsLoading(false);
      setError('Error loading video');
      console.error('Video loading error:', status.error);
    }
  };

  const handlePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    }
  };

  const handleReplay = async () => {
    if (videoRef.current) {
      await videoRef.current.replayAsync();
    }
  };

  if (!videoUrl) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>No Video Available</Text>
            <Text style={styles.modalText}>
              A demonstration video is not available for {exerciseName} yet.
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Handle YouTube/Vimeo links - open in browser
  if (isYouTubeUrl(videoUrl) || isVimeoUrl(videoUrl)) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Watch Video</Text>
            <Text style={styles.modalText}>
              This video will open in your browser.
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.openButton]}
                onPress={() => {
                  handleOpenExternalVideo(videoUrl);
                  onClose();
                }}
              >
                <Text style={styles.actionButtonText}>Open Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // If expo-av is not installed, show a message
  if (!Video || !ResizeMode) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Video Player Not Available</Text>
            <Text style={styles.modalText}>
              To watch exercise videos, please install expo-av:
            </Text>
            <Text style={styles.codeText}>npx expo install expo-av</Text>
            <Text style={styles.modalText}>
              For now, you can open the video in your browser if it's a YouTube or Vimeo link.
            </Text>
            {isYouTubeUrl(videoUrl) || isVimeoUrl(videoUrl) ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.openButton]}
                onPress={() => {
                  handleOpenExternalVideo(videoUrl);
                  onClose();
                }}
              >
                <Text style={styles.actionButtonText}>Open in Browser</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.modalTitle}>{exerciseName}</Text>
            <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.videoContainer}>
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00ff88" />
                <Text style={styles.loadingText}>Loading video...</Text>
              </View>
            )}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    setError(null);
                    setIsLoading(true);
                    handleReplay();
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
            {Video && ResizeMode ? (
              <Video
                ref={videoRef}
                source={{ uri: videoUrl }}
                style={styles.video}
                resizeMode={ResizeMode.CONTAIN}
                isLooping={true}
                shouldPlay={false}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                useNativeControls={true}
              />
            ) : (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Video player not available</Text>
                <Text style={[styles.loadingText, { fontSize: 12, marginTop: 10 }]}>
                  Install expo-av to watch videos
                </Text>
              </View>
            )}
          </View>

          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handlePlayPause}
              disabled={isLoading || !!error}
            >
              <Text style={styles.controlButtonText}>
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleReplay}
              disabled={isLoading || !!error}
            >
              <Text style={styles.controlButtonText}>↻ Replay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.95,
    maxHeight: SCREEN_HEIGHT * 0.9,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  modalText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
  },
  closeIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIconText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  videoContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.5,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 15,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 14,
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  controlButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  openButton: {
    backgroundColor: '#00ff88',
  },
  actionButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
  },
});

