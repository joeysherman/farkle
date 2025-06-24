import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { AvatarBuilderRef } from '../components/AvatarBuilder';

export const useAvatarUpload = () => {
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const uploadAvatar = async (
    avatarBuilderRef: React.RefObject<AvatarBuilderRef>,
    userId: string
  ): Promise<string | null> => {
    if (!avatarBuilderRef.current || !userId) {
      return null;
    }

    try {
      setIsUploading(true);
      setUploadStatus('Generating your avatar...');

      // Generate the avatar blob
      const blob = await avatarBuilderRef.current.generateAvatarBlob();
      if (!blob) {
        throw new Error('Failed to generate avatar image');
      }

      setUploadStatus('Uploading avatar to cloud storage...');

      // Create a unique filename
      const fileName = `avatar-${userId}-${Date.now()}.png`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      setUploadStatus('Finalizing avatar setup...');

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setUploadStatus('');
      return urlData.publicUrl;
    } catch (error) {
      setUploadStatus('');
      console.error('Error uploading avatar:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadAvatar,
    uploadStatus,
    isUploading,
  };
}; 