import { Request, Response } from 'express';
import { getChatRoomList } from '../../helpers/chat.helper';
import ChatRoom from '../../models/chat-room.model';
import AccountUser from '../../models/account-user.model';
import ChatMessage from '../../models/chat-message.model';
import { timeAgo } from '../../helpers/format.helper';
import FormData from 'form-data';
import axios from 'axios';
import { domainCDN, pathAdmin } from '../../configs/variable.config';
import { aiGenerateAnswer } from '../../helpers/ai.helper';

export const myChatList = async (req: Request, res: Response) => {
  const isSuperAdmin = res.locals.accountAdmin?.isSuperAdmin || false;
  // Danh sách phòng chat
  const chatRoomList: any = await getChatRoomList(res.locals.accountAdmin.id, isSuperAdmin);
  
  res.render("admin/pages/my-chat-list", {
    pageTitle: "Danh sách tin nhắn của bạn",
    chatRoomList: chatRoomList
  });
}

export const detail = async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = res.locals.accountAdmin?.isSuperAdmin || false;
    // Danh sách phòng chat
    // const chatRoomList: any = await getChatRoomList(res.locals.accountAdmin.id, isSuperAdmin);

    // Chi tiết phòng chat
    const id = req.params.id;
    const findRoom: any = { _id: id };
    if (!isSuperAdmin) {
      findRoom.adminId = res.locals.accountAdmin.id;
    }

    const chatRoomDetail = await ChatRoom.findOne(findRoom);

    if(!chatRoomDetail) {
      res.redirect('/admin/dashboard');
      return;
    }

    // Thông tin người dùng
    const infoUser = await AccountUser.findOne({
      _id: chatRoomDetail.userId
    });

    if(!infoUser) {
      res.redirect('/admin/dashboard');
      return;
    }

    // Danh sách tin nhắn
    const chatMessages: any = await ChatMessage.find({
      roomId: id
    });

    for (const item of chatMessages) {
      item.createdAtFormat = timeAgo(item.createdAt);
    }

    // Cập nhật số tin nhắn chưa đọc = 0
    const updateQuery: any = { _id: id };
    if (!isSuperAdmin) {
      updateQuery.adminId = res.locals.accountAdmin.id;
    }

    await ChatRoom.updateOne(updateQuery, {
      "unreadCount.admin": 0
    });

    // Danh sách phòng chat
    const chatRoomList: any = await getChatRoomList(res.locals.accountAdmin.id, isSuperAdmin);

    res.render("admin/pages/chat-detail", {
      pageTitle: "Chi tiết tin nhắn",
      chatRoomList: chatRoomList,
      chatRoomDetail: chatRoomDetail,
      infoUser: infoUser,
      chatMessages: chatMessages
    });
  } catch (error) {
    res.redirect('/admin/dashboard');
  }
}

export const messages = async (req: Request, res: Response) => {
  const adminId = res.locals.accountAdmin.id;
  const isSuperAdmin = res.locals.accountAdmin?.isSuperAdmin || false;
  const { limit = 20, roomId, lastMessageId } = req.query;

  if(!adminId) {
    res.json({
      code: "error",
      message: "Thất bại!"
    })
    return;
  }

  // Lấy thông tin phòng chat
  const findRoom: any = { _id: roomId };
  if (!isSuperAdmin) {
    findRoom.adminId = adminId;
  }

  const chatRoom = await ChatRoom.findOne(findRoom);

  if(!chatRoom) {
    res.json({
      code: "error",
      message: "Thất bại!"
    })
    return;
  }

  // Danh sách tin nhắn
  const find: any = {
    roomId: chatRoom?.id
  };

  if(lastMessageId) {
    find._id = {
      $lt: lastMessageId
    };
  }

  const chatMessages: any = await ChatMessage
    .find(find)
    .sort({
      createdAt: "desc" // mới nhất trước
    })
    .limit(parseInt(`${limit}`))
    .lean();

  for (const item of chatMessages) {
    item.createdAtFormat = timeAgo(item.createdAt);
  }
  
  res.json({
    code: "success",
    message: "Thành công!",
    messages: lastMessageId ? chatMessages : chatMessages.reverse()
  })
}

export const uploadPost = async (req: Request, res: Response) => {
  try {
    const adminId = res.locals.accountAdmin.id;
    const roomId = req.body.roomId;
    const files = req.files as Express.Multer.File[];

    if(!files || !files.length) {
      res.json({
        code: "error",
        message: "Vui lòng gửi kèm file!"
      })
      return;
    }

    const chatRoomDetail = await ChatRoom.findOne({
      adminId: adminId,
      _id: roomId
    });

    if(!chatRoomDetail) {
      res.json({
        code: "error",
        message: "Không tìm thấy phòng chat!"
      })
      return;
    }

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
    })
    formData.append('folderPath', `chats/${chatRoomDetail.userId}`);

    const response = await axios.post(`${domainCDN}/file-manager/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
      } // cần thiết để gửi đúng multipart/form-data
    });

    if(response.data.code == "error") {
      res.json({
        code: "error",
        message: "Lỗi upload!"
      })
      return;
    }
    
    const saveLinks = response.data.saveLinks;
    const fileUrls = saveLinks.map((item: any) => `${item.folder}/${item.filename}`);
    res.json({
      code: "success",
      message: "Upload thành công!",
      fileUrls: fileUrls
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const changeStatusPatch = async (req: Request, res: Response) => {
  try {
    const adminId = res.locals.accountAdmin.id;
    const { roomId, status } = req.body;

    const chatRoomDetail = await ChatRoom.findOne({
      adminId: adminId,
      _id: roomId
    });

    if(!chatRoomDetail) {
      res.json({
        code: "error",
        message: "Không tìm thấy phòng chat!"
      })
      return;
    }

    await ChatRoom.updateOne({
      _id: roomId
    }, {
      status: status
    })
    
    res.json({
      code: "success",
      message: "Đã đổi trạng thái!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const rate = async (req: Request, res: Response) => {
  try {    
    // Chi tiết phòng chat
    const id = req.params.id;
    const chatRoomDetail = await ChatRoom.findOne({
      _id: id
    });

    if(!chatRoomDetail) {
      res.redirect(`/${pathAdmin}/dashboard`);
      return;
    }

    const ratingList = chatRoomDetail.rating.reverse();

    // Danh sách phòng chat
    const chatRoomList: any = await getChatRoomList(res.locals.accountAdmin.id);
    
    res.render("admin/pages/chat-rate", {
      pageTitle: "Chi tiết tin nhắn",
      chatRoomList: chatRoomList,
      chatRoomDetail: chatRoomDetail,
      ratingList: ratingList
    });
  } catch (error) {
    res.redirect('/admin/dashboard');
  }
}

export const suggestReply = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;

    const messages = await ChatMessage.find({
      roomId: roomId
    })
    .sort({
      createdAt: "desc"
    })
    .limit(10)
    .lean();

    const string = messages
      .reverse()
      .map(item => {
        return `${item.senderRole === "user" ? "Khách hàng" : "Admin"}: ${item.content}`;
      })
      .join("\n");

    const prompt = `
      Bạn là nhân viên chăm sóc khách hàng.

      Đây là đoạn hội thoại giữa khách hàng và admin:

      ${string}

      Hãy gợi ý 3 câu trả lời ngắn gọn, lịch sự để admin trả lời khách hàng.
      Viết bằng tiếng Việt.
    `;

    // const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
    //   },
    //   body: JSON.stringify({
    //     model: "openai/gpt-oss-120b",
    //     messages: [
    //       {
    //         role: "user",
    //         content: prompt
    //       }
    //     ]
    //   })
      const content = await aiGenerateAnswer(prompt);

    res.json({
      code: "success",
      message: "Thành công!",
      content: content
    });

    // const data = await response.json();
    } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: error instanceof Error ? error.message : "Không thể lấy gợi ý từ AI lúc này!"
    })
  }
}

export const editReplyPost = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const { content: contentChat } = req.body;

    if (!contentChat || !`${contentChat}`.trim()) {
      res.json({
        code: "error",
        message: "Vui lòng nhập nội dung câu trả lời cần AI sửa!"
      });
      return;
    }

    const messages = await ChatMessage.find({
      roomId: roomId
    })
    .sort({
      createdAt: "desc"
    })
    .limit(10)
    .lean();

    const string = messages
      .reverse()
      .map(item => {
        return `${item.senderRole === "user" ? "Khách hàng" : "Admin"}: ${item.content}`;
      })
      .join("\n");

    const prompt = `
      Bạn là nhân viên chăm sóc khách hàng.

      Đây là đoạn hội thoại giữa khách hàng và admin:

      ${string}

      Đây là câu trả lời admin đang soạn: ${contentChat}

      Hãy sửa câu trả lời của admin đang soạn và gợi ý 3 câu trả lời hay hơn.
      Viết bằng tiếng Việt.
    `;

    const content = await aiGenerateAnswer(prompt);

    res.json({
      code: "success",
      message: "Thành công!",
      content: content
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const summary = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;

    const messages = await ChatMessage.find({
      roomId: roomId
    })
    .sort({
      createdAt: "desc"
    })
    .limit(10)
    .lean();

    const string = messages
      .reverse()
      .map(item => {
        return `${item.senderRole === "user" ? "Khách hàng" : "Admin"}: ${item.content}`;
      })
      .join("\n");

    const prompt = `
      Bạn là nhân viên chăm sóc khách hàng.

      Đây là đoạn hội thoại giữa khách hàng và admin:

      ${string}

      Hãy tóm tắt lại đoạn hội thoại giữa khách hàng và admin để thật ngắn gọn, súc tích.
    `;

    const content = await aiGenerateAnswer(prompt);

    res.json({
      code: "success",
      message: "Thành công!",
      content: content
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: error instanceof Error ? error.message : "Không thể lấy gợi ý từ AI lúc này!"
    });
  }
}

export const customerEmotions = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;

    const messages = await ChatMessage.find({
      roomId: roomId
    })
    .sort({
      createdAt: "desc"
    })
    .limit(20)
    .lean();

    const string = messages
      .reverse()
      .map(item => {
        return `${item.senderRole === "user" ? "Khách hàng" : "Admin"}: ${item.content}`;
      })
      .join("\n");

    const prompt = `
      Bạn là nhân viên chăm sóc khách hàng.

      Đây là đoạn hội thoại giữa khách hàng và admin:

      ${string}

      Hãy phân tích kỹ đoạn hội thoại giữa khách hàng và admin, sau đó phân tích cảm xúc khách hàng. Phản hồi kết quả cảm xúc của khách hàng đang như thế nào, khách hàng này có tiềm năng hay không.
    `;

    const content = await aiGenerateAnswer(prompt);

    res.json({
      code: "success",
      message: "Thành công!",
      content: content
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}