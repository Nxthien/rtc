class CallChannel < ApplicationCable::Channel
  def subscribed
    stream_from "videocalls:#{params[:roomId]}"
  end

  def unsubscribed
    stop_all_streams
  end
end
