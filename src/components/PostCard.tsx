"use client";

import {
  createComment,
  deletePost,
  getPosts,
  toggleLike,
} from "@/actions/post.action";

import { useUser } from "@clerk/nextjs";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { Card, CardContent } from "./ui/card";
import Link from "next/link";
import { Avatar, AvatarImage } from "@radix-ui/react-avatar";
import { formatDistanceToNow } from "date-fns";
import { DeleteAlertDialog } from "./DeleteAlertDialog";

type Posts = Awaited<ReturnType<typeof getPosts>>;
type Post = Posts[number];

function PostCard({ post, dbUserId }: { post: Post; dbUserId: string | null }) {
  const { user } = useUser();
  const [newComment, setNewComment] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasLiked, setHasLiked] = useState(
    post.likes.some((like) => like.userId === dbUserId)
  );
  const [optimisticLikes, setOptimisticLikes] = useState(post._count.likes);

  const handleLike = async () => {
    if (isLiking) return;
    try {
      setIsLiking(true);
      setHasLiked((prev) => !prev);
      setOptimisticLikes((prev) => prev + (hasLiked ? -1 : 1));
      await toggleLike(post.id);
    } catch (error) {
      setOptimisticLikes(post._count.likes);
      setHasLiked(post.likes.some((like) => like.userId === dbUserId));
    } finally {
      setIsLiking(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || isCommenting) return;
    try {
      setIsCommenting(true);
      const result = await createComment(post.id, newComment);
      if (result?.success) {
        toast.success("Comment posted successfully");
        setNewComment("");
      }
    } catch (error) {
      toast.error("Failed to add comment");
    } finally {
      setIsCommenting(false);
    }
  };

  const handleDeletePost = async () => {
    if (isDeleting) return;
    try {
      setIsDeleting(true);
      const result = await deletePost(post.id);
      if (result.success) toast.success("Post deleted successfully");
      else throw new Error(result.error);
    } catch (error) {
      toast.error("Failed to delete post");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 s:p-6">
        <div className="flex space-x-0 sm:space-x-4">
          <Link href={`/profile/${post.author.username}`}>
            <Avatar>
              <AvatarImage
                src={post.author.image ?? "/avatar.png"}
                className="rounded-full w-10 h-10"
              />
            </Avatar>
          </Link>

          {/* POST HEADER & TEXT CONTENT */}
          <div className="flex-1 ">
            <div className="flex items-start justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 truncate">
                <Link
                  href={`/profile/${post.author.username}`}
                  className="font-semibold truncate"
                >
                  {post.author.name}
                </Link>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Link href={`/profile/${post.author.username}`}>
                    @{post.author.username}
                  </Link>
                  <span>•</span>
                  <span>
                    {formatDistanceToNow(new Date(post.createdAt))} ago
                  </span>
                </div>
              </div>
              {/* Check if current user is the post author */}
              {dbUserId === post.author.id && (
                <DeleteAlertDialog
                  isDeleting={isDeleting}
                  onDelete={handleDeletePost}
                />
              )}
            </div>
            <p className="mt-2 text-sm text-foreground break-words">
              {post.content}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PostCard;
