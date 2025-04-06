"use server";

import { prisma } from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function syncUser() {
    try {
        const {userId} = await auth();
        const user = await currentUser(); 

        if(!userId || !user) return;

        const existingUser = await prisma.user.findUnique({
            where: {
                clerkId: userId,
            }
        })

        if(existingUser) return existingUser;
        

        const dbUser = await prisma.user.create({
            data:{
                clerkId: userId,
                name: `${user.firstName || ""} ${user.lastName || ""}`,
                username: user.username ?? user.emailAddresses[0].emailAddress.split("@")[0],
                email: user.emailAddresses[0].emailAddress,
                image: user.imageUrl,
            }
        });
        
        return dbUser;
    } catch (error) {
        console.log("Error syncing user", error);
    }
}

export async function getUserByClerkId(clerkId: string) {
    return prisma.user.findUnique({
        where: {
            clerkId,
        }, 
        include: {
            _count: {
                select:{
                    followers: true,
                    following: true,
                    posts: true,
                }
            }
        }
    })
}

export async function getDbUserId() {
    const {userId:clerkId} = await auth();
    if(!clerkId) return null;
    
    const user = await getUserByClerkId(clerkId); 

    if(!user) throw new Error("User not found");

    return user.id;
}

export async function getRandomUsers() {
    try {
        const userId = await getDbUserId();

        if(!userId) return [];

        // get 3 random users exclude ourselves and users that we already follow 
        const randomUsers = await prisma.user.findMany({
            where: {
                AND: [
                    {NOT: {id: userId}},
                    {NOT: {followers: {some: {followerId: userId}}}}
                ]
            },
            select: {
                id: true,
                name: true,
                username: true,
                image: true,
                _count: {
                    select: {
                        followers: true,
                        
                    }
                }
            },
            take: 3,
        })
        return randomUsers;
    } catch (error) {
        console.log("Error getting random users", error);
        return [];
    }
}


export async function toggleFollow(targetUserId:string) {
    try {
        const userId = await getDbUserId();

        if(!userId) return;

        if(userId === targetUserId) throw new Error("Cannot follow yourself");
        const existingFollow = await prisma.follows.findUnique({
            where: {
                followerId_followingId: {
                    followerId: userId,
                    followingId: targetUserId
                }
            }
        })
        //unfollow
        if(existingFollow) {
            await prisma.follows.delete({
                where:{
                    followerId_followingId: {
                        followerId: userId,
                        followingId: targetUserId
                    }
                }
            })
        } else {
            //follow
            await prisma.$transaction([
                prisma.follows.create({
                    data: {
                        followerId: userId,
                        followingId: targetUserId
                    }
                }),

                prisma.notification.create({
                    data: {
                        type:"FOLLOW",
                        userId: targetUserId,
                        creatorId:userId
                    }
                })
            ])
        }
        revalidatePath("/");
        return {success: true};

    } catch (error) {
        console.log("Error toggling follow", error);
        return {success: false, error: "Error toggling follow"};
    }
}

export async function toggleLike(postId: string) {
    try {
      const userId = await getDbUserId();
      if (!userId) return;
  
      // check if like exists
      const existingLike = await prisma.like.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });
  
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { authorId: true },
      });
  
      if (!post) throw new Error("Post not found");
  
      if (existingLike) {
        // unlike
        await prisma.like.delete({
          where: {
            userId_postId: {
              userId,
              postId,
            },
          },
        });
      } else {
        // like and create notification (only if liking someone else's post)
        await prisma.$transaction([
          prisma.like.create({
            data: {
              userId,
              postId,
            },
          }),
          ...(post.authorId !== userId
            ? [
                prisma.notification.create({
                  data: {
                    type: "LIKE",
                    userId: post.authorId, // recipient (post author)
                    creatorId: userId, // person who liked
                    postId,
                  },
                }),
              ]
            : []),
        ]);
      }
  
      revalidatePath("/");
      return { success: true };
    } catch (error) {
      console.error("Failed to toggle like:", error);
      return { success: false, error: "Failed to toggle like" };
    }
}

export async function createComment(postId: string, content: string) {
    try {
      const userId = await getDbUserId();
  
      if (!userId) return;
      if (!content) throw new Error("Content is required");
  
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { authorId: true },
      });
  
      if (!post) throw new Error("Post not found");
  
      // Create comment and notification in a transaction
      const [comment] = await prisma.$transaction(async (tx) => {
        // Create comment first
        const newComment = await tx.comment.create({
          data: {
            content,
            authorId: userId,
            postId,
          },
        });
  
        // Create notification if commenting on someone else's post
        if (post.authorId !== userId) {
          await tx.notification.create({
            data: {
              type: "COMMENT",
              userId: post.authorId,
              creatorId: userId,
              postId,
              commentId: newComment.id,
            },
          });
        }
  
        return [newComment];
      });
  
      revalidatePath(`/`);
      return { success: true, comment };
    } catch (error) {
      console.error("Failed to create comment:", error);
      return { success: false, error: "Failed to create comment" };
    }
}

