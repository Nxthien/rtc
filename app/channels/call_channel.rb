class CallChannel < ApplicationCable::Channel
  def subscribed
  end

  def unsubscribed
    stop_all_streams
  end
end
