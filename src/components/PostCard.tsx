import { getPosts } from "@/actions/post.action";
import { toggleLike } from "@/actions/user.action";
import { useUser } from "@clerk/nextjs";
import React, { useState } from "react";

type Posts = Awaited<ReturnType<typeof getPosts>>;
type Post = Posts[number];

function PostCard({ post, dbUserId }: { post: Post; dbUserId: string | null }) {
  const { user } = useUser();
  const [newComment, setNewComment] = useState("");
  const [iscommenting, setIsCommenting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasLiked, setHasLiked] = useState(post.likes.some(like => like.userId === dbUserId));
  const [optimisticLikes, setOptimisticLikes] = useState(post._count.likes);

  const handleLike = async () => {
    if (isLiking) return
    try {
      setIsLiking(true)
      setHasLiked(prev => !prev)
      setOptimisticLikes(prev => prev + (hasLiked ? -1 : 1))
      await toggleLike(post.id)

    }catch (error) {
      setOptimisticLikes(post._count.likes)
      setHasLiked(post.likes.some(like => like.userId === dbUserId))
    } finally {
      setIsLiking(false)
    }
  }

  const handleAddComment = async () => {} 

  const handleDeletePost = async () => {}

  return <div>PostCard</div>;
}

export default PostCard;
