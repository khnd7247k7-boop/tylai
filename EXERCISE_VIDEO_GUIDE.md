# Exercise Video Integration Guide

## Overview

You can now add video demonstrations to exercises so beginners can see proper form and technique. The video player supports multiple video sources and formats.

## How to Add Videos to Exercises

### Option 1: Local Video Files (Recommended for Production)

1. **Add videos to your project**:
   - Create a `assets/videos/` folder in your project root
   - Add your exercise videos (MP4 format recommended)
   - Name them with the exercise ID (e.g., `push-ups.mp4`, `bench-press.mp4`)

2. **Update the exercise database**:
   ```typescript
   // In src/data/exerciseDatabase.ts
   {
     id: 'push-ups',
     name: 'Push-ups',
     // ... other fields
     videoUrl: require('../assets/videos/push-ups.mp4'), // Local file
   }
   ```

### Option 2: Cloud Storage (Firebase Storage, AWS S3, etc.)

1. **Upload videos to cloud storage**
2. **Get the public URL**
3. **Add to exercise database**:
   ```typescript
   {
     id: 'bench-press',
     name: 'Bench Press',
     // ... other fields
     videoUrl: 'https://your-storage.com/videos/bench-press.mp4', // Cloud URL
   }
   ```

### Option 3: YouTube/Vimeo Links

1. **Upload your video to YouTube or Vimeo**
2. **Set visibility to "Public" or "Unlisted"**
3. **Add the link to exercise database**:
   ```typescript
   {
     id: 'squats',
     name: 'Squats',
     // ... other fields
     videoUrl: 'https://www.youtube.com/watch?v=YOUR_VIDEO_ID', // YouTube link
     // OR
     videoUrl: 'https://vimeo.com/YOUR_VIDEO_ID', // Vimeo link
   }
   ```

## Video Requirements

- **Format**: MP4 (H.264 codec recommended for best compatibility)
- **Resolution**: 1080p (1920x1080) or 720p (1280x720)
- **Duration**: 30-60 seconds recommended (showing 2-3 reps)
- **Aspect Ratio**: 16:9 or 9:16 (portrait for mobile)
- **File Size**: Keep under 10MB for local files, or use cloud storage for larger files

## Video Content Tips

1. **Show proper form**: Demonstrate correct technique from multiple angles
2. **Common mistakes**: Optionally show what NOT to do
3. **Key points**: Highlight important form cues (e.g., "keep your back straight")
4. **Multiple angles**: Front, side, and back views help users understand form
5. **Slow motion**: Include slow-motion sections for complex movements

## Example: Adding a Video to an Exercise

```typescript
// In src/data/exerciseDatabase.ts
export const exerciseDatabase: ExerciseData[] = [
  {
    id: 'push-ups',
    name: 'Push-ups',
    movementPattern: 'push',
    primaryMuscleGroup: 'chest',
    secondaryMuscleGroups: ['shoulders', 'triceps', 'core'],
    equipmentRequired: ['bodyweight', 'mat'],
    difficulty: 'beginner',
    potentialRisks: ['Wrist strain', 'Shoulder impingement'],
    alternatives: ['Knee Push-ups', 'Incline Push-ups'],
    category: 'strength',
    muscleRegion: 'mid',
    // Add video URL here
    videoUrl: 'https://your-storage.com/videos/push-ups.mp4',
    // Optional: thumbnail for video preview
    videoThumbnail: 'https://your-storage.com/thumbnails/push-ups.jpg',
  },
  // ... more exercises
];
```

## How It Works in the App

1. **During Workout**: When a user is performing an exercise, they'll see a green ▶ button next to the exercise name
2. **Tap to Watch**: Tapping the button opens a full-screen video player
3. **Video Controls**: Users can play, pause, and replay the video
4. **YouTube/Vimeo**: If you use YouTube or Vimeo links, the app will open them in the browser

## Installation

The video player uses `expo-av`. Install it with:

```bash
npx expo install expo-av
```

## Video Storage Recommendations

### For Development/Testing:
- Use local files or YouTube/Vimeo links

### For Production:
- **Firebase Storage**: Good for apps already using Firebase
- **AWS S3**: Scalable and cost-effective
- **Cloudinary**: Optimized for video delivery
- **YouTube/Vimeo**: Free hosting, but opens in browser

## Best Practices

1. **Start with key exercises**: Add videos to the most common exercises first
2. **Consistent quality**: Use the same camera angle and lighting for all videos
3. **Update regularly**: Replace videos if you improve your form or technique
4. **User feedback**: Ask users which exercises need videos most
5. **File optimization**: Compress videos to reduce file size while maintaining quality

## Troubleshooting

### Video won't play:
- Check that the URL is accessible
- Verify the video format (MP4 recommended)
- Ensure network connectivity for cloud videos

### Video is too large:
- Compress the video using tools like HandBrake or FFmpeg
- Use cloud storage instead of bundling with app
- Consider using YouTube/Vimeo for large files

### Video doesn't show button:
- Verify `videoUrl` is set in the exercise data
- Check that `getExerciseData()` is finding the exercise correctly

## Future Enhancements

Potential features to add:
- Video playback speed control (0.5x, 1x, 1.5x, 2x)
- Picture-in-picture mode
- Video annotations/overlays (form cues, muscle highlights)
- Multiple video angles per exercise
- User-uploaded form check videos
- AI form analysis from video





